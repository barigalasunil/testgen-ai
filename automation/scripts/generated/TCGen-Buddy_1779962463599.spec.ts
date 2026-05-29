import { test, expect, APIResponse } from '@playwright/test';

async function login(request: any, username: string, password: string): Promise<string> {
  const resp = await request.post('/api/v1/auth/login', {
    data: { username, password },
  });
  expect(resp.status()).toBe(200);
  const body = await resp.json();
  expect(body).toHaveProperty('token');
  return body.token;
}

test('Successful user login with valid credentials', async ({ request }) => {
  const response = await request.post('/api/v1/auth/login', {
    data: { username: 'standard_user', password: 'secret_sauce' },
  });
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body).toMatchObject({
    message: 'Login successful',
  });
  expect(body).toHaveProperty('token');
  expect(body).toHaveProperty('user_id');
});

test('Failed user login with invalid credentials', async ({ request }) => {
  const response = await request.post('/api/v1/auth/login', {
    data: { username: 'invalid_user', password: 'wrong_password' },
  });
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body).toEqual({
    error: 'Epic sadface: Username and password do not match any user in this service',
  });
});

test('Failed user login with missing password', async ({ request }) => {
  const response = await request.post('/api/v1/auth/login', {
    data: { username: 'standard_user', password: '' },
  });
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body).toEqual({
    error: 'Epic sadface: Username and password do not match any user in this service',
  });
});

test('Security: Access inventory endpoint without authentication token', async ({ request }) => {
  const response = await request.get('/api/v1/products');
  expect(response.status()).toBe(403);
  const body = await response.json();
  expect(body).toHaveProperty('error');
});

test('Fetch inventory list with valid authentication', async ({ request }) => {
  const token = await login(request, 'standard_user', 'secret_sauce');
  const response = await request.get('/api/v1/products', {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body).toHaveProperty('products');
  expect(Array.isArray(body.products)).toBeTruthy();
  for (const product of body.products) {
    expect(product).toHaveProperty('id');
    expect(product).toHaveProperty('name');
    expect(product).toHaveProperty('price');
    expect(product.price).toBeGreaterThanOrEqual(0);
    expect(product).toHaveProperty('stock');
    expect(product.stock).toBeGreaterThanOrEqual(0);
  }
});

test('Add a specific item to the cart successfully', async ({ request }) => {
  const token = await login(request, 'standard_user', 'secret_sauce');
  const response = await request.post('/api/v1/cart/add', {
    headers: { Authorization: `Bearer ${token}` },
    data: { cart_id: 'cart_112233', product_id: 'prod_001', quantity: 1 },
  });
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body).toMatchObject({
    cart_id: 'cart_112233',
    total_items: 1,
    items: [{ product_id: 'prod_001', quantity: 1 }],
  });
});

test('Attempt to add an out-of-stock item to the cart', async ({ request }) => {
  const token = await login(request, 'standard_user', 'secret_sauce');
  const response = await request.post('/api/v1/cart/add', {
    headers: { Authorization: `Bearer ${token}` },
    data: { cart_id: 'cart_112233', product_id: 'prod_001', quantity: 1 },
  });
  expect(response.status()).toBe(400);
  const body = await response.json();
  expect(body).toEqual({ error: 'Product is out of stock' });
});

test('Boundary: Add maximum allowed quantity of an item to the cart', async ({ request }) => {
  const token = await login(request, 'standard_user', 'secret_sauce');
  const response = await request.post('/api/v1/cart/add', {
    headers: { Authorization: `Bearer ${token}` },
    data: { cart_id: 'cart_112233', product_id: 'prod_001', quantity: 15 },
  });
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.cart_id).toBe('cart_112233');
  expect(body.total_items).toBe(15);
  expect(body.items[0]).toMatchObject({ product_id: 'prod_001', quantity: 15 });
});

test('Complete checkout process with valid information', async ({ request }) => {
  const token = await login(request, 'standard_user', 'secret_sauce');
  const response = await request.post('/api/v1/checkout', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      cart_id: 'cart_112233',
      customer_details: { first_name: 'John', last_name: 'Doe', postal_code: '12345' },
    },
  });
  expect(response.status()).toBe(201);
  const body = await response.json();
  expect(body).toHaveProperty('order_id');
  expect(body).toMatchObject({
    status: 'SUCCESS',
    message: 'Thank you for your order!',
    summary: { item_total: 29.99, tax: 2.4, grand_total: 32.39 },
  });
});

test('Attempt checkout with missing first name', async ({ request }) => {
  const token = await login(request, 'standard_user', 'secret_sauce');
  const response = await request.post('/api/v1/checkout', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      cart_id: 'cart_112233',
      customer_details: { first_name: '', last_name: 'Doe', postal_code: '12345' },
    },
  });
  expect(response.status()).toBe(422);
  const body = await response.json();
  expect(body).toHaveProperty('validation');
  expect(body.validation).toHaveProperty('first_name');
});

test('Attempt checkout with missing last name', async ({ request }) => {
  const token = await login(request, 'standard_user', 'secret_sauce');
  const response = await request.post('/api/v1/checkout', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      cart_id: 'cart_112233',
      customer_details: { first_name: 'John', last_name: '', postal_code: '12345' },
    },
  });
  expect(response.status()).toBe(422);
  const body = await response.json();
  expect(body).toHaveProperty('validation');
  expect(body.validation).toHaveProperty('last_name');
});

test('Attempt checkout with missing postal code', async ({ request }) => {
  const token = await login(request, 'standard_user', 'secret_sauce');
  const response = await request.post('/api/v1/checkout', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      cart_id: 'cart_112233',
      customer_details: { first_name: 'John', last_name: 'Doe', postal_code: '' },
    },
  });
  expect(response.status()).toBe(422);
  const body = await response.json();
  expect(body).toHaveProperty('validation');
  expect(body.validation).toHaveProperty('postal_code');
});

test('End-to-end purchase journey for a standard user', async ({ request }) => {
  // Login
  const loginResp = await request.post('/api/v1/auth/login', {
    data: { username: 'standard_user', password: 'secret_sauce' },
  });
  expect(loginResp.status()).toBe(200);
  const loginBody = await loginResp.json();
  const token = loginBody.token;
  expect(token).toBeTruthy();

  // Get products
  const productsResp = await request.get('/api/v1/products', {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(productsResp.status()).toBe(200);
  const productsBody = await productsResp.json();
  expect(Array.isArray(productsBody.products)).toBeTruthy();

  // Add to cart
  const addResp = await request.post('/api/v1/cart/add', {
    headers: { Authorization: `Bearer ${token}` },
    data: { cart_id: 'cart_112233', product_id: 'prod_001', quantity: 1 },
  });
  expect(addResp.status()).toBe(200);
  const addBody = await addResp.json();
  expect(addBody.cart_id).toBe('cart_112233');

  // Checkout
  const checkoutResp = await request.post('/api/v1/checkout', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      cart_id: 'cart_112233',
      customer_details: { first_name: 'John', last_name: 'Doe', postal_code: '12345' },
    },
  });
  expect(checkoutResp.status()).toBe(201);
  const checkoutBody = await checkoutResp.json();
  expect(checkoutBody).toHaveProperty('order_id');
  expect(checkoutBody.summary).toMatchObject({
    item_total: 29.99,
    tax: 2.4,
    grand_total: 32.39,
  });
});