const API_BASE = 'http://127.0.0.1:5000/api';

function getApiUrl(path) {
  return `${API_BASE}${path}`;
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

function productImageUrls(product) {
  const images = Array.isArray(product.images) && product.images.length > 0 ? product.images : [product.image_url];
  // The backend now stores one public image URL directly on products.image_url.
  return images.filter(Boolean).slice(0, 1);
}

function hasTooManyImages(form, messageTarget) {
  const imageInput = form.querySelector('input[type="file"][name="image"]');
  if (imageInput) {
    const isMultiple = imageInput.hasAttribute('multiple');
    const limit = isMultiple ? 3 : 1;
    if (imageInput.files.length > limit) {
      showMessage(messageTarget, `A product can have at most ${limit} image${limit > 1 ? 's' : ''}`, 'error');
      return true;
    }
  }
  return false;
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
    link.addEventListener('click', () => {
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
          <td>${productImageUrls(product)[0] ? `<img src="${productImageUrls(product)[0]}" alt="${product.name}" class="table-image" />` : '<div class="product-thumb small">P</div>'}</td>
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

    const imageInput = addProductForm.querySelector('input[type="file"][name="image"]');
    if (imageInput) {
      imageInput.addEventListener('change', () => {
        const display = addProductForm.querySelector('.selected-files');
        if (display) {
          if (imageInput.files.length > 0) {
            const names = Array.from(imageInput.files).map((f) => f.name).join(', ');
            display.textContent = `Selected: ${names}`;
          } else {
            display.textContent = '';
          }
        }
      });
    }

    addProductForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(addProductForm);
      const messageTarget = document.querySelector('.form-status');
      if (hasTooManyImages(addProductForm, messageTarget)) return;
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
        const display = addProductForm.querySelector('.selected-files');
        if (display) display.textContent = '';
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
        const existingImages = document.querySelector('#existingImages');
        if (existingImages) {
          const images = productImageUrls(product);
          existingImages.innerHTML = images.map((imageUrl, index) => `<img src="${imageUrl}" alt="${product.name} image ${index + 1}" />`).join('');
        }
      } catch (error) {
        showMessage(document.querySelector('.form-status'), error.message, 'error');
      }
    }
    editProductForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const productId = getQueryParam('id');
      const formData = new FormData(editProductForm);
      const messageTarget = document.querySelector('.form-status');
      if (hasTooManyImages(editProductForm, messageTarget)) return;
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
      } catch (error) {
        showMessage(messageTarget, error.message || 'Unable to update product', 'error');
      } finally {
        setLoading(submitButton, false);
      }
    });
  }
});
