const FALLBACK_IMAGE = 'https://images.pexels.com/photos/27575174/pexels-photo-27575174.jpeg?auto=compress&cs=tinysrgb&w=700';
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

function supabaseBucket() {
  return window.SSD_CONFIG?.SUPABASE_BUCKET || 'saree_images';
}

function handleImageError(imgEl) {
  if (!imgEl || imgEl.dataset.fallbackApplied) return;
  imgEl.dataset.fallbackApplied = 'true';
  imgEl.src = FALLBACK_IMAGE;
}

function showMessage(target, message, kind = 'error') {
  if (!target) return;
  target.textContent = message;
  target.className = `form-message ${kind}`.trim();
}

function setLoading(button, loading) {
  if (!button) return;
  button.disabled = loading;
  button.textContent = loading ? 'Please wait...' : button.dataset.originalText || button.textContent;
}

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

const MAX_PRODUCT_IMAGES = 4;

function productImageUrls(product) {
  if (Array.isArray(product.images) && product.images.length > 0) {
    return product.images.filter(Boolean).slice(0, MAX_PRODUCT_IMAGES);
  }
  // image_url is stored as a comma-separated string (up to MAX_PRODUCT_IMAGES
  // images) -- split it back out into individual URLs.
  return (product.image_url || '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean)
    .slice(0, MAX_PRODUCT_IMAGES);
}

// Drives a fixed grid of MAX_PRODUCT_IMAGES boxes (used by both Add Product and
// Edit Product). Slot 0 is always the main image shown to customers. Each box is
// independently empty/existing/new, so there's no way to exceed the limit and no
// separate "too many images" check is needed - the grid itself enforces it.
function setupImageSlots({ grid, fileInput, hint, initialImages = [] }) {
  const slots = Array.from({ length: MAX_PRODUCT_IMAGES }, (_, index) => {
    const url = initialImages[index];
    return url ? { type: 'existing', url } : null;
  });
  let pendingIndex = null;

  function render() {
    grid.innerHTML = slots.map((slot, index) => {
      if (!slot) {
        return `
          <button type="button" class="image-slot empty" data-slot="${index}">
            <span class="plus-icon">+</span>
            <span>${index === 0 ? 'Main Image' : 'Add Image'}</span>
          </button>
        `;
      }
      const src = slot.type === 'existing' ? slot.url : slot.previewUrl;
      return `
        <div class="image-slot filled" data-slot="${index}">
          <img src="${src}" alt="Product image ${index + 1}" onerror="handleImageError(this)" />
          ${index === 0 ? '<span class="image-slot-badge">Main</span>' : ''}
          <button type="button" class="image-slot-remove" data-remove-slot="${index}" aria-label="Remove this image" title="Remove this image">&times;</button>
        </div>
      `;
    }).join('');
    if (hint) hint.textContent = `${slots.filter(Boolean).length} / ${MAX_PRODUCT_IMAGES} images used`;
  }

  grid.addEventListener('click', (event) => {
    const removeButton = event.target.closest('[data-remove-slot]');
    if (removeButton) {
      const index = Number(removeButton.dataset.removeSlot);
      if (slots[index]?.type === 'new') URL.revokeObjectURL(slots[index].previewUrl);
      slots[index] = null;
      render();
      return;
    }
    const emptySlot = event.target.closest('.image-slot.empty');
    if (emptySlot) {
      pendingIndex = Number(emptySlot.dataset.slot);
      fileInput.value = '';
      fileInput.click();
    }
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file || pendingIndex === null) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      alert('Only JPG, PNG, and WEBP images are supported');
      return;
    }
    if (slots[pendingIndex]?.type === 'new') URL.revokeObjectURL(slots[pendingIndex].previewUrl);
    slots[pendingIndex] = { type: 'new', file, previewUrl: URL.createObjectURL(file) };
    pendingIndex = null;
    render();
  });

  render();

  return {
    // Uploads any newly-picked files straight to Supabase Storage, keeps
    // existing image URLs as-is, drops removed slots, and returns the
    // resulting comma-separated image_url (slot order preserved, gaps closed).
    async resolveImageUrl() {
      const bucket = supabaseBucket();
      const resolved = [];
      for (const slot of slots) {
        if (!slot) continue;
        if (slot.type === 'existing') {
          resolved.push(slot.url);
          continue;
        }
        const safeName = slot.file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const path = `products/${crypto.randomUUID()}_${safeName}`;
        const { error: uploadError } = await window.supabaseClient.storage
          .from(bucket)
          .upload(path, slot.file, { contentType: slot.file.type });
        if (uploadError) throw new Error(uploadError.message);
        const { data } = window.supabaseClient.storage.from(bucket).getPublicUrl(path);
        resolved.push(data.publicUrl);
      }
      return resolved.join(',');
    },
    setImages(urls) {
      slots.forEach((slot, index) => {
        if (slot?.type === 'new') URL.revokeObjectURL(slot.previewUrl);
        slots[index] = urls[index] ? { type: 'existing', url: urls[index] } : null;
      });
      render();
    }
  };
}

// Redirects to login.html when there's no active Supabase Auth session.
// Returns true (page may proceed) or false (already redirecting away).
async function checkAuth() {
  const currentPage = window.location.pathname.split('/').pop();
  if (currentPage === 'login.html') return true;
  const { data: { session } } = await window.supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

document.addEventListener('DOMContentLoaded', async () => {
  const links = document.querySelectorAll('.sidebar-nav a');
  links.forEach((link) => {
    link.addEventListener('click', async (event) => {
      if (link.getAttribute('href') === 'login.html') {
        event.preventDefault();
        try {
          await window.supabaseClient.auth.signOut();
        } catch {
          // Ignore network errors; redirect to login regardless.
        } finally {
          window.location.href = 'login.html';
        }
        return;
      }
      links.forEach((item) => item.classList.remove('active'));
      link.classList.add('active');
    });
  });

  const loginForm = document.querySelector('.login-form');
  if (loginForm) {
    const submitButton = loginForm.querySelector('button');
    submitButton.dataset.originalText = submitButton.textContent;
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const email = loginForm.querySelector('input[type="text"]').value.trim();
      const password = loginForm.querySelector('input[type="password"]').value;
      const messageTarget = document.querySelector('.login-message');
      setLoading(submitButton, true);
      try {
        const { error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message);
        showMessage(messageTarget, 'Login successful', 'success');
        window.location.href = 'dashboard.html';
      } catch (error) {
        showMessage(messageTarget, error.message || 'Unable to login', 'error');
      } finally {
        setLoading(submitButton, false);
      }
    });
  }

  const dashboardPage = document.querySelector('.stats-grid');
  if (dashboardPage) {
    const authOk = await checkAuth();
    if (!authOk) return;
    try {
      const { data, error } = await window.supabaseClient.from('products').select('*');
      if (error) throw new Error(error.message);
      const products = data || [];
      const totalProducts = products.length;
      const categories = [...new Set(products.map((product) => product.category).filter(Boolean))].length;
      const lowStock = products.filter((product) => Number(product.stock) <= 5).length;
      document.querySelectorAll('.stat-card strong')[0].textContent = totalProducts;
      document.querySelectorAll('.stat-card strong')[1].textContent = categories;
      document.querySelectorAll('.stat-card strong')[2].textContent = lowStock;
      const list = document.querySelector('.product-list');
      if (list) {
        list.innerHTML = products.slice(0, 3).map((product) => `
          <div class="product-item">
            <div class="product-thumb">${(product.name || 'P').charAt(0).toUpperCase()}</div>
            <div>
              <h4>${product.name}</h4>
              <p>${product.category || 'Uncategorized'}</p>
            </div>
            <span class="stock-badge ${Number(product.stock) <= 5 ? 'low' : ''}">${Number(product.stock) > 0 ? 'In Stock' : 'Out of Stock'}</span>
          </div>
        `).join('');
      }
    } catch (error) {
      const list = document.querySelector('.product-list');
      if (list) list.innerHTML = `<div class="product-item"><div><h4>Unable to load products</h4><p>${error.message}</p></div></div>`;
    }
  }

  const productsTable = document.querySelector('table');
  if (productsTable) {
    const authOk = await checkAuth();
    if (!authOk) return;
    const tbody = productsTable.querySelector('tbody');
    const messageTarget = document.querySelector('.panel-header p');
    try {
      const { data, error } = await window.supabaseClient.from('products').select('*').order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      const products = data || [];
      tbody.innerHTML = products.map((product) => `
        <tr>
          <td>${productImageUrls(product)[0] ? `<img src="${productImageUrls(product)[0]}" alt="${product.name}" class="table-image" onerror="handleImageError(this)" />` : '<div class="product-thumb small">P</div>'}</td>
          <td>${product.name}</td>
          <td>${product.category}</td>
          <td>₹${Number(product.price).toLocaleString('en-IN')}</td>
          <td>${product.stock}</td>
          <td>
            <div class="action-group">
              <a href="edit-product.html?id=${product.id}" class="btn btn-secondary">Edit</a>
              <button type="button" class="btn btn-muted" data-delete-id="${product.id}">Delete</button>
            </div>
          </td>
        </tr>
      `).join('');
      if (messageTarget) messageTarget.textContent = 'Products loaded.';
    } catch (error) {
      tbody.innerHTML = `<tr><td colspan="6">${error.message}</td></tr>`;
      if (messageTarget) messageTarget.textContent = error.message;
    }
  }

  document.addEventListener('click', async (event) => {
    const deleteButton = event.target.closest('[data-delete-id]');
    if (deleteButton) {
      const id = deleteButton.dataset.deleteId;
      if (!window.confirm('Delete this product?')) return;
      try {
        const { error } = await window.supabaseClient.from('products').delete().eq('id', id);
        if (error) throw new Error(error.message);
        window.location.reload();
      } catch (error) {
        alert(error.message || 'Delete failed');
      }
    }
  });

  const addProductForm = document.querySelector('.product-form');
  if (addProductForm && window.location.pathname.includes('add-product.html')) {
    const authOk = await checkAuth();
    if (!authOk) return;
    const submitButton = addProductForm.querySelector('button');
    submitButton.dataset.originalText = submitButton.textContent;

    const imageSlots = setupImageSlots({
      grid: addProductForm.querySelector('#imageSlotGrid'),
      fileInput: document.querySelector('#slotFileInput'),
      hint: document.querySelector('#imageSlotHint')
    });

    addProductForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const messageTarget = document.querySelector('.form-status');
      setLoading(submitButton, true);
      try {
        const name = addProductForm.querySelector('[name="name"]').value.trim();
        const category = addProductForm.querySelector('[name="category"]').value.trim();
        const price = Number(addProductForm.querySelector('[name="price"]').value);
        const stock = Number(addProductForm.querySelector('[name="stock"]').value);
        if (!name || !category) throw new Error('Name and category are required');
        if (!(price > 0)) throw new Error('Price must be greater than zero');
        if (!(stock >= 0)) throw new Error('Stock cannot be negative');

        const imageUrl = await imageSlots.resolveImageUrl();
        const nowIso = new Date().toISOString();
        const { error } = await window.supabaseClient.from('products').insert({
          id: crypto.randomUUID(),
          name,
          category,
          description: addProductForm.querySelector('[name="description"]').value.trim(),
          offer: addProductForm.querySelector('[name="offer"]').value.trim(),
          price,
          stock,
          image_url: imageUrl,
          created_at: nowIso,
          updated_at: nowIso
        });
        if (error) throw new Error(error.message);

        showMessage(messageTarget, 'Product saved!', 'success');
        addProductForm.reset();
        imageSlots.setImages([]);
      } catch (error) {
        showMessage(messageTarget, error.message || 'Unable to save product', 'error');
      } finally {
        setLoading(submitButton, false);
      }
    });
  }

  const editProductForm = document.querySelector('.product-form');
  if (editProductForm && window.location.pathname.includes('edit-product.html')) {
    const authOk = await checkAuth();
    if (!authOk) return;
    const productId = getQueryParam('id');
    const submitButton = editProductForm.querySelector('button');
    submitButton.dataset.originalText = submitButton.textContent;

    const imageSlots = setupImageSlots({
      grid: editProductForm.querySelector('#imageSlotGrid'),
      fileInput: document.querySelector('#slotFileInput'),
      hint: document.querySelector('#imageSlotHint')
    });

    if (productId) {
      try {
        const { data: product, error } = await window.supabaseClient.from('products').select('*').eq('id', productId).single();
        if (error) throw new Error(error.message);
        editProductForm.querySelectorAll('input, textarea').forEach((field) => {
          const name = field.name || field.getAttribute('placeholder');
          if (!name) return;
          if (field.type === 'number') field.value = product[name] || '';
          else if (field.type !== 'file') field.value = product[name] || '';
        });
        const descriptionField = editProductForm.querySelector('textarea');
        if (descriptionField) descriptionField.value = product.description || '';
        imageSlots.setImages(productImageUrls(product));
      } catch (error) {
        showMessage(document.querySelector('.form-status'), error.message, 'error');
      }
    }

    editProductForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const productId = getQueryParam('id');
      const messageTarget = document.querySelector('.form-status');
      setLoading(submitButton, true);
      try {
        const price = Number(editProductForm.querySelector('[name="price"]').value);
        const stock = Number(editProductForm.querySelector('[name="stock"]').value);
        if (!(price > 0)) throw new Error('Price must be greater than zero');
        if (!(stock >= 0)) throw new Error('Stock cannot be negative');

        const imageUrl = await imageSlots.resolveImageUrl();
        const { data: product, error } = await window.supabaseClient.from('products').update({
          name: editProductForm.querySelector('[name="name"]').value.trim(),
          category: editProductForm.querySelector('[name="category"]').value.trim(),
          description: editProductForm.querySelector('[name="description"]').value.trim(),
          offer: editProductForm.querySelector('[name="offer"]').value.trim(),
          price,
          stock,
          image_url: imageUrl,
          updated_at: new Date().toISOString()
        }).eq('id', productId).select().single();
        if (error) throw new Error(error.message);

        showMessage(messageTarget, 'Product updated!', 'success');
        imageSlots.setImages(productImageUrls(product || {}));
      } catch (error) {
        showMessage(messageTarget, error.message || 'Unable to update product', 'error');
      } finally {
        setLoading(submitButton, false);
      }
    });
  }
});
