const API_BASE = 'http://127.0.0.1:5000/api';
const FALLBACK_IMAGE = 'https://images.pexels.com/photos/27575174/pexels-photo-27575174.jpeg?auto=compress&cs=tinysrgb&w=700';

function getApiUrl(path) {
  return `${API_BASE}${path}`;
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

function getAuthHeaders(includeJson = false) {
  const headers = {};
  if (includeJson) headers['Content-Type'] = 'application/json';
  return headers;
}

function getRequestOptions(method = 'GET', body = null, includeJson = false) {
  const options = {
    method,
    credentials: 'include',
    headers: getAuthHeaders(includeJson),
  };

  if (body !== null) {
    options.body = body;
  }

  return options;
}

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

const MAX_PRODUCT_IMAGES = 4;

function productImageUrls(product) {
  const images = Array.isArray(product.images) && product.images.length > 0 ? product.images : [product.image_url];
  // Products can have up to MAX_PRODUCT_IMAGES images; the backend stores them as a
  // comma-separated image_url and exposes them back as the `images` array (see routes.py).
  return images.filter(Boolean).slice(0, MAX_PRODUCT_IMAGES);
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
    if (slots[pendingIndex]?.type === 'new') URL.revokeObjectURL(slots[pendingIndex].previewUrl);
    slots[pendingIndex] = { type: 'new', file, previewUrl: URL.createObjectURL(file) };
    pendingIndex = null;
    render();
  });

  render();

  return {
    // Builds exactly what the backend expects: new files (in slot order) to attach
    // under the repeated `image` field, the kept existing URLs (in slot order) for
    // `keep_images`, and an `image_order` token per slot so the server can zip the
    // two back together in the right positions (see routes.py update_product).
    appendTo(formData) {
      const order = [];
      const keepUrls = [];
      slots.forEach((slot) => {
        if (!slot) { order.push('empty'); return; }
        if (slot.type === 'existing') { order.push('keep'); keepUrls.push(slot.url); return; }
        order.push('new');
        formData.append('image', slot.file);
      });
      formData.append('keep_images', keepUrls.join(','));
      formData.append('image_order', order.join(','));
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

function redirectIfUnauthenticated() {
  const currentPage = window.location.pathname.split('/').pop();
  if (currentPage === 'login.html') return;
  const token = document.cookie.split('; ').find((item) => item.startsWith('token='));
  if (!token) {
    window.location.href = 'login.html';
  }
}

async function checkAuth() {
  try {
    const response = await fetch(getApiUrl('/auth/me'), { credentials: 'include' });
    if (!response.ok) {
      throw new Error('Unauthorized');
    }
    return true;
  } catch {
    redirectIfUnauthenticated();
    return false;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const links = document.querySelectorAll('.sidebar-nav a');
  links.forEach((link) => {
    link.addEventListener('click', async (event) => {
      if (link.getAttribute('href') === 'login.html') {
        event.preventDefault();
        try {
          await fetch(getApiUrl('/auth/logout'), { method: 'POST', credentials: 'include' });
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
      const username = loginForm.querySelector('input[type="text"]').value.trim();
      const password = loginForm.querySelector('input[type="password"]').value;
      const messageTarget = document.querySelector('.login-message');
      setLoading(submitButton, true);
      try {
        const response = await fetch(getApiUrl('/auth/login'), getRequestOptions('POST', JSON.stringify({ username, password }), true));
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Invalid login');
        showMessage(messageTarget, result.message || 'Login successful', 'success');
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
      const response = await fetch(getApiUrl('/products'), { credentials: 'include' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to load products');
      const products = result.products || [];
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
      const response = await fetch(getApiUrl('/products'), { credentials: 'include' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to load products');
      const products = result.products || [];
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
      if (messageTarget) messageTarget.textContent = 'Products loaded from the backend.';
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
        const response = await fetch(getApiUrl(`/products/${id}`), {
          method: 'DELETE',
          credentials: 'include'
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Delete failed');
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
      const formData = new FormData(addProductForm);
      imageSlots.appendTo(formData);
      const messageTarget = document.querySelector('.form-status');
      setLoading(submitButton, true);
      try {
        const response = await fetch(getApiUrl('/products'), {
          method: 'POST',
          body: formData,
          credentials: 'include'
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unable to save product');
        showMessage(messageTarget, result.message || 'Product saved!', 'success');
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
        const response = await fetch(getApiUrl(`/products/${productId}`), { credentials: 'include' });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Product not found');
        const product = result.product || {};
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
      const formData = new FormData(editProductForm);
      imageSlots.appendTo(formData);
      setLoading(submitButton, true);
      try {
        const response = await fetch(getApiUrl(`/products/${productId}`), {
          method: 'PUT',
          body: formData,
          credentials: 'include'
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unable to update product');
        showMessage(messageTarget, result.message || 'Product updated!', 'success');
        imageSlots.setImages(productImageUrls(result.product || {}));
      } catch (error) {
        showMessage(messageTarget, error.message || 'Unable to update product', 'error');
      } finally {
        setLoading(submitButton, false);
      }
    });
  }
});
