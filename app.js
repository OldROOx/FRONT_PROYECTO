// Configuración base
const API_URL = 'http://localhost:4000/api';
const WS_URL = 'ws://localhost:4000/ws';

// Elementos del DOM
const sections = document.querySelectorAll('.section');
const navButtons = document.querySelectorAll('nav button');


let stockWS, ordersWS, cancellationsWS;

async function fetchWithCORS(url, options = {}) {
    const defaultOptions = {
        mode: 'cors',
        headers: {
            'Content-Type': 'application/json',
            'Origin': 'http://localhost'
        },
        credentials: 'include'
    };

    return fetch(url, { ...defaultOptions, ...options });
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    // Cargar datos iniciales
    loadProducts();
    loadProviders();
    loadOrders();
    loadSales();
    loadSupplierOrders();

    // Configurar navegación
    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            navButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            const targetId = button.id.replace('Btn', 'Section');
            sections.forEach(section => {
                section.classList.remove('active');
            });
            document.getElementById(targetId).classList.add('active');
        });
    });

    // Configurar formularios
    setupProductForm();
    setupProviderForm();
    setupOrderForm();
    setupSaleForm();
    setupSupplierOrderForm();

    // Inicializar WebSockets
    connectWebSockets();
});

// Conexión a WebSockets
function connectWebSockets() {
    // WebSocket para stock
    stockWS = new WebSocket(`${WS_URL}/stock?session_id=web-client-stock`);
    stockWS.onmessage = event => {
        const notification = JSON.parse(event.data);
        if (notification.type === 'low_stock') {
            const notificationElement = document.createElement('div');
            notificationElement.classList.add('notification-item');
            notificationElement.innerHTML = `
                <p><strong>⚠️ Stock Bajo:</strong> Producto ID ${notification.entity_id}</p>
                <p>Stock actual: ${notification.stock_level} unidades</p>
                <small>${new Date(notification.timestamp).toLocaleString()}</small>
            `;

            const container = document.getElementById('stockNotificationsList');
            container.insertBefore(notificationElement, container.firstChild);
        }
    };

    // WebSocket para órdenes
    ordersWS = new WebSocket(`${WS_URL}/orders?session_id=web-client-orders`);
    ordersWS.onmessage = event => {
        const notification = JSON.parse(event.data);
        if (notification.type === 'new_order') {
            const notificationElement = document.createElement('div');
            notificationElement.classList.add('notification-item');
            notificationElement.innerHTML = `
                <p><strong>🛒 Nueva Orden:</strong> ID ${notification.entity_id}</p>
                <p>Monto: $${notification.amount.toFixed(2)}</p>
                <small>${new Date(notification.timestamp).toLocaleString()}</small>
            `;

            const container = document.getElementById('orderNotificationsList');
            container.insertBefore(notificationElement, container.firstChild);

            // Actualizar la tabla correspondiente
            if (notification.products_url.includes('/pedidos/')) {
                loadOrders();
            } else if (notification.products_url.includes('/ventas/')) {
                loadSales();
            } else if (notification.products_url.includes('/ordenes/')) {
                loadSupplierOrders();
            }
        }
    };

    // WebSocket para cancelaciones
    cancellationsWS = new WebSocket(`${WS_URL}/cancellations?session_id=web-client-cancellations`);
    cancellationsWS.onmessage = event => {
        const notification = JSON.parse(event.data);
        if (notification.type === 'cancel_order') {
            const notificationElement = document.createElement('div');
            notificationElement.classList.add('notification-item');
            notificationElement.innerHTML = `
                <p><strong>❌ Orden Cancelada:</strong> ID ${notification.entity_id}</p>
                <p>Monto: $${notification.amount.toFixed(2)}</p>
                ${notification.provider ? `<p>Proveedor: ${notification.provider}</p>` : ''}
                <small>${new Date(notification.timestamp).toLocaleString()}</small>
            `;

            const container = document.getElementById('cancelNotificationsList');
            container.insertBefore(notificationElement, container.firstChild);

            // Actualizar las tablas
            loadOrders();
            loadSales();
            loadSupplierOrders();
        }
    };
}

// Funciones de carga de datos
async function loadProducts() {
    try {
        const response = await fetchWithCORS(`${API_URL}/productos`);
        const products = await response.json();

        const tableBody = document.getElementById('productsTableBody');
        tableBody.innerHTML = '';

        products.forEach(product => {
            const row = document.createElement('tr');

            // Clase para destacar productos con bajo stock
            if (product.existencia <= 5) {
                row.classList.add('low-stock');
            }

            row.innerHTML = `
                <td>${product.id_producto}</td>
                <td>${product.nombre}</td>
                <td>${product.descripcion || ''}</td>
                <td>$${product.precio}</td>
                <td>${product.existencia}</td>
                <td>${product.id_proveedor}</td>
                <td>
                    <button class="edit-product" data-id="${product.id_producto}">Editar</button>
                    <button class="delete-product" data-id="${product.id_producto}">Eliminar</button>
                </td>
            `;

            tableBody.appendChild(row);
        });

        // Actualizar selectores de productos
        updateProductSelectors(products);

        // Configurar eventos para botones de acción
        document.querySelectorAll('.edit-product').forEach(button => {
            button.addEventListener('click', () => editProduct(button.dataset.id));
        });

        document.querySelectorAll('.delete-product').forEach(button => {
            button.addEventListener('click', () => deleteProduct(button.dataset.id));
        });

    } catch (error) {
        console.error('Error al cargar productos:', error);
        showMessage('Error al cargar productos', true);
    }
}

async function loadProviders() {
    try {
        const response = await fetchWithCORS(`${API_URL}/proveedores`);
        const providers = await response.json();

        const tableBody = document.getElementById('providersTableBody');
        tableBody.innerHTML = '';

        providers.forEach(provider => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${provider.id_proveedor}</td>
                <td>${provider.nombre}</td>
                <td>${provider.direccion || ''}</td>
                <td>${provider.telefono || ''}</td>
                <td>${provider.email || ''}</td>
                <td>
                    <button class="edit-provider" data-id="${provider.id_proveedor}">Editar</button>
                    <button class="delete-provider" data-id="${provider.id_proveedor}">Eliminar</button>
                </td>
            `;

            tableBody.appendChild(row);
        });

        // Actualizar selectores de proveedores
        updateProviderSelectors(providers);

        // Configurar eventos para botones de acción
        document.querySelectorAll('.edit-provider').forEach(button => {
            button.addEventListener('click', () => editProvider(button.dataset.id));
        });

        document.querySelectorAll('.delete-provider').forEach(button => {
            button.addEventListener('click', () => deleteProvider(button.dataset.id));
        });

    } catch (error) {
        console.error('Error al cargar proveedores:', error);
        showMessage('Error al cargar proveedores', true);
    }
}

async function loadOrders() {
    try {
        const response = await fetchWithCORS(`${API_URL}/pedidos`);
        const orders = await response.json();

        const tableBody = document.getElementById('ordersTableBody');
        tableBody.innerHTML = '';

        orders.forEach(order => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${order.id_pedido}</td>
                <td>${new Date(order.fecha_pedido).toLocaleString()}</td>
                <td>${order.estado}</td>
                <td>$${order.total.toFixed(2)}</td>
                <td>
                    <button class="view-order" data-id="${order.id_pedido}">Ver</button>
                    ${order.estado === 'pendiente' ?
                `<button class="cancel-order" data-id="${order.id_pedido}">Cancelar</button>` : ''}
                </td>
            `;

            tableBody.appendChild(row);
        });

        // Configurar eventos para botones de acción
        document.querySelectorAll('.view-order').forEach(button => {
            button.addEventListener('click', () => viewOrderDetails(button.dataset.id));
        });

        document.querySelectorAll('.cancel-order').forEach(button => {
            button.addEventListener('click', () => cancelOrder(button.dataset.id));
        });

    } catch (error) {
        console.error('Error al cargar pedidos:', error);
        showMessage('Error al cargar pedidos', true);
    }
}

async function loadSales() {
    try {
        const response = await fetchWithCORS(`${API_URL}/ventas`);
        const sales = await response.json();

        const tableBody = document.getElementById('salesTableBody');
        tableBody.innerHTML = '';

        sales.forEach(sale => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${sale.id_venta}</td>
                <td>${new Date(sale.fecha_venta).toLocaleString()}</td>
                <td>${sale.estado}</td>
                <td>$${sale.total.toFixed(2)}</td>
                <td>
                    <button class="view-sale" data-id="${sale.id_venta}">Ver</button>
                    ${sale.estado === 'completada' ?
                `<button class="cancel-sale" data-id="${sale.id_venta}">Cancelar</button>` : ''}
                </td>
            `;

            tableBody.appendChild(row);
        });

        // Configurar eventos para botones de acción
        document.querySelectorAll('.view-sale').forEach(button => {
            button.addEventListener('click', () => viewSaleDetails(button.dataset.id));
        });

        document.querySelectorAll('.cancel-sale').forEach(button => {
            button.addEventListener('click', () => cancelSale(button.dataset.id));
        });

    } catch (error) {
        console.error('Error al cargar ventas:', error);
        showMessage('Error al cargar ventas', true);
    }
}

async function loadSupplierOrders() {
    try {
        const response = await fetchWithCORS(`${API_URL}/ordenes`);
        const supplierOrders = await response.json();

        const tableBody = document.getElementById('supplierOrdersTableBody');
        tableBody.innerHTML = '';

        // Obtener nombres de proveedores
        const providersResponse = await fetchWithCORS(`${API_URL}/proveedores`);
        const providers = await providersResponse.json();
        const providersMap = {};
        providers.forEach(provider => {
            providersMap[provider.id_proveedor] = provider.nombre;
        });

        supplierOrders.forEach(order => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${order.id_orden_proveedor}</td>
                <td>${providersMap[order.id_proveedor] || order.id_proveedor}</td>
                <td>${new Date(order.fecha_orden).toLocaleString()}</td>
                <td>${order.estado}</td>
                <td>$${order.total}</td>
                <td>
                    <button class="view-supplier-order" data-id="${order.id_orden_proveedor}">Ver</button>
                    ${order.estado === 'pendiente' ?
                `<button class="receive-supplier-order" data-id="${order.id_orden_proveedor}">Recibir</button>
                        <button class="cancel-supplier-order" data-id="${order.id_orden_proveedor}">Cancelar</button>` : ''}
                </td>
            `;

            tableBody.appendChild(row);
        });

        // Configurar eventos para botones de acción
        document.querySelectorAll('.view-supplier-order').forEach(button => {
            button.addEventListener('click', () => viewSupplierOrderDetails(button.dataset.id));
        });

        document.querySelectorAll('.receive-supplier-order').forEach(button => {
            button.addEventListener('click', () => receiveSupplierOrder(button.dataset.id));
        });

        document.querySelectorAll('.cancel-supplier-order').forEach(button => {
            button.addEventListener('click', () => cancelSupplierOrder(button.dataset.id));
        });

    } catch (error) {
        console.error('Error al cargar órdenes de proveedor:', error);
        showMessage('Error al cargar órdenes de proveedor', true);
    }
}

// Actualizar selectores
function updateProductSelectors(products) {
    const selectors = document.querySelectorAll('.product-select');

    selectors.forEach(selector => {
        const currentValue = selector.value;

        // Conservar solo la primera opción
        while (selector.childNodes.length > 1) {
            selector.removeChild(selector.lastChild);
        }

        // Agregar opciones de productos
        products.forEach(product => {
            const option = document.createElement('option');
            option.value = product.id_producto;
            option.textContent = `${product.nombre} - $${product.precio} (${product.existencia} unidades)`;
            option.dataset.price = product.precio;
            option.dataset.stock = product.existencia;
            selector.appendChild(option);
        });

        // Restaurar valor seleccionado si existía
        if (currentValue) {
            selector.value = currentValue;
        }
    });
}

function updateProviderSelectors(providers) {
    const selectors = document.querySelectorAll('#productProvider, #orderProvider');

    selectors.forEach(selector => {
        const currentValue = selector.value;

        // Conservar solo la primera opción
        while (selector.childNodes.length > 1) {
            selector.removeChild(selector.lastChild);
        }

        // Agregar opciones de proveedores
        providers.forEach(provider => {
            const option = document.createElement('option');
            option.value = provider.id_proveedor;
            option.textContent = provider.nombre;
            selector.appendChild(option);
        });

        // Restaurar valor seleccionado si existía
        if (currentValue) {
            selector.value = currentValue;
        }
    });
}

// Configuración de formularios
function setupProductForm() {
    document.getElementById('newProductBtn').addEventListener('click', () => {
        document.getElementById('productForm').style.display = 'block';
        document.getElementById('addProductForm').reset();
    });

    document.getElementById('cancelProductBtn').addEventListener('click', () => {
        document.getElementById('productForm').style.display = 'none';
    });

    document.getElementById('addProductForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const productData = {
            nombre: document.getElementById('productName').value,
            descripcion: document.getElementById('productDesc').value,
            precio: parseInt(document.getElementById('productPrice').value),
            existencia: parseInt(document.getElementById('productStock').value),
            id_proveedor: parseInt(document.getElementById('productProvider').value)
        };

        try {
            const response = await fetchWithCORS(`${API_URL}/productos`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(productData)
            });

            if (response.ok) {
                document.getElementById('productForm').style.display = 'none';
                loadProducts();
                showMessage('Producto agregado correctamente');
            } else {
                const error = await response.json();
                showMessage(`Error: ${error.error}`, true);
            }
        } catch (error) {
            console.error('Error al crear producto:', error);
            showMessage('Error al crear producto', true);
        }
    });
}

function setupProviderForm() {
    document.getElementById('newProviderBtn').addEventListener('click', () => {
        document.getElementById('providerForm').style.display = 'block';
        document.getElementById('addProviderForm').reset();
    });

    document.getElementById('cancelProviderBtn').addEventListener('click', () => {
        document.getElementById('providerForm').style.display = 'none';
    });

    document.getElementById('addProviderForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const providerData = {
            nombre: document.getElementById('providerName').value,
            direccion: document.getElementById('providerAddress').value,
            telefono: document.getElementById('providerPhone').value,
            email: document.getElementById('providerEmail').value
        };

        try {
            const response = await fetchWithCORS(`${API_URL}/proveedores`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(providerData)
            });

            if (response.ok) {
                document.getElementById('providerForm').style.display = 'none';
                loadProviders();
                showMessage('Proveedor agregado correctamente');
            } else {
                const error = await response.json();
                showMessage(`Error: ${error.error}`, true);
            }
        } catch (error) {
            console.error('Error al crear proveedor:', error);
            showMessage('Error al crear proveedor', true);
        }
    });
}

function setupOrderForm() {
    document.getElementById('newOrderBtn').addEventListener('click', () => {
        document.getElementById('orderForm').style.display = 'block';
        document.getElementById('addOrderForm').reset();

        // Limpiar productos y dejar solo uno
        const productsContainer = document.getElementById('orderProducts');
        productsContainer.innerHTML = `
            <div class="order-product">
                <select class="product-select" required>
                    <option value="">Seleccione un producto</option>
                </select>
                <input type="number" class="product-quantity" placeholder="Cantidad" required min="1">
                <button type="button" class="remove-product">X</button>
            </div>
        `;

        // Cargar productos en el selector
        loadProducts();

        // Reiniciar total
        document.getElementById('orderTotal').textContent = '0.00';

        // Configurar eventos para eliminar productos
        setupRemoveProductEvents();
    });

    document.getElementById('cancelOrderBtn').addEventListener('click', () => {
        document.getElementById('orderForm').style.display = 'none';
    });

    document.getElementById('addProductToOrder').addEventListener('click', () => {
        const productsContainer = document.getElementById('orderProducts');
        const newProduct = document.createElement('div');
        newProduct.classList.add('order-product');
        newProduct.innerHTML = `
            <select class="product-select" required>
                <option value="">Seleccione un producto</option>
            </select>
            <input type="number" class="product-quantity" placeholder="Cantidad" required min="1">
            <button type="button" class="remove-product">X</button>
        `;

        productsContainer.appendChild(newProduct);

        // Actualizar selector de productos
        fetchWithCORS(`${API_URL}/productos`)
            .then(response => response.json())
            .then(products => {
                const selector = newProduct.querySelector('.product-select');
                products.forEach(product => {
                    const option = document.createElement('option');
                    option.value = product.id_producto;
                    option.textContent = `${product.nombre} - $${product.precio} (${product.existencia} unidades)`;
                    option.dataset.price = product.precio;
                    option.dataset.stock = product.existencia;
                    selector.appendChild(option);
                });
            });

        // Configurar evento para eliminar
        setupRemoveProductEvents();

        // Configurar evento para calcular total
        setupCalculateTotalEvents();
    });

    document.getElementById('addOrderForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        // Verificar que hay productos
        const products = document.querySelectorAll('#orderProducts .order-product');
        if (products.length === 0) {
            showMessage('Debe agregar al menos un producto', true);
            return;
        }

        // Calcular total
        let total = 0;
        const detalles = [];

        for (const product of products) {
            const productId = product.querySelector('.product-select').value;
            const quantity = parseInt(product.querySelector('.product-quantity').value);
            const price = parseFloat(product.querySelector('.product-select').selectedOptions[0].dataset.price);

            if (!productId || isNaN(quantity) || quantity <= 0) {
                showMessage('Todos los productos deben tener ID y cantidad válida', true);
                return;
            }

            const subtotal = price * quantity;
            total += subtotal;

            detalles.push({
                id_producto: parseInt(productId),
                cantidad: quantity,
                precio_unitario: price,
                subtotal: subtotal
            });
        }

        // Crear pedido
        const orderData = {
            estado: 'pendiente',
            total: total
        };

        try {
            // Crear pedido
            const response = await fetchWithCORS(`${API_URL}/pedidos`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(orderData)
            });

            if (response.ok) {
                const result = await response.json();
                const orderId = result.id;

                // Agregar productos al pedido
                for (const detalle of detalles) {
                    await fetchWithCORS(`${API_URL}/pedidos/${orderId}/productos`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(detalle)
                    });
                }

                document.getElementById('orderForm').style.display = 'none';
                loadOrders();
                loadProducts(); // Actualizar stock
                showMessage('Pedido creado correctamente');
            } else {
                const error = await response.json();
                showMessage(`Error: ${error.error}`, true);
            }
        } catch (error) {
            console.error('Error al crear pedido:', error);
            showMessage('Error al crear pedido', true);
        }
    });

    // Configurar evento para calcular total
    setupCalculateTotalEvents();
}

function setupSaleForm() {
    // Similar a setupOrderForm pero para ventas
    document.getElementById('newSaleBtn').addEventListener('click', () => {
        document.getElementById('saleForm').style.display = 'block';
        document.getElementById('addSaleForm').reset();

        // Limpiar productos y dejar solo uno
        const productsContainer = document.getElementById('saleProducts');
        productsContainer.innerHTML = `
            <div class="sale-product">
                <select class="product-select" required>
                    <option value="">Seleccione un producto</option>
                </select>
                <input type="number" class="product-quantity" placeholder="Cantidad" required min="1">
                <button type="button" class="remove-product">X</button>
            </div>
        `;

        // Cargar productos en el selector
        loadProducts();

        // Reiniciar total
        document.getElementById('saleTotal').textContent = '0.00';

        // Configurar eventos para eliminar productos
        setupRemoveProductEvents();
    });

    // Resto del código similar a setupOrderForm...
}

function setupSupplierOrderForm() {
    // Similar a setupOrderForm pero para órdenes de proveedor
    document.getElementById('newSupplierOrderBtn').addEventListener('click', () => {
        document.getElementById('supplierOrderForm').style.display = 'block';
        document.getElementById('addSupplierOrderForm').reset();

        // Limpiar productos y dejar solo uno
        const productsContainer = document.getElementById('orderSupplierProducts');
        productsContainer.innerHTML = `
            <div class="supplier-order-product">
                <select class="product-select" required>
                    <option value="">Seleccione un producto</option>
                </select>
                <input type="number" class="product-quantity" placeholder="Cantidad" required min="1">
                <input type="number" class="product-price" placeholder="Precio unitario" required min="0">
                <button type="button" class="remove-product">X</button>
            </div>
        `;

        // Cargar productos y proveedores en los selectores
        loadProducts();
        loadProviders();

        // Reiniciar total
        document.getElementById('supplierOrderTotal').textContent = '0.00';

        // Configurar eventos para eliminar productos
        setupRemoveProductEvents();
    });

    // Resto del código similar a setupOrderForm...
}

// Funciones auxiliares
function setupRemoveProductEvents() {
    document.querySelectorAll('.remove-product').forEach(button => {
        button.addEventListener('click', (e) => {
            const parentDiv = e.target.parentElement;
            const grandparentDiv = parentDiv.parentElement;

            // Solo eliminar si hay más de un producto
            if (grandparentDiv.children.length > 1) {
                parentDiv.remove();

                // Recalcular total
                if (grandparentDiv.id === 'orderProducts') {
                    calculateOrderTotal();
                } else if (grandparentDiv.id === 'saleProducts') {
                    calculateSaleTotal();
                } else if (grandparentDiv.id === 'orderSupplierProducts') {
                    calculateSupplierOrderTotal();
                }
            }
        });
    });
}

function setupCalculateTotalEvents() {
    // Añadir eventos para calcular totales en tiempo real
    document.querySelectorAll('#orderProducts .product-select, #orderProducts .product-quantity').forEach(element => {
        element.addEventListener('change', calculateOrderTotal);
    });

    document.querySelectorAll('#saleProducts .product-select, #saleProducts .product-quantity').forEach(element => {
        element.addEventListener('change', calculateSaleTotal);
    });

    document.querySelectorAll('#orderSupplierProducts .product-select, #orderSupplierProducts .product-quantity, #orderSupplierProducts .product-price').forEach(element => {
        element.addEventListener('change', calculateSupplierOrderTotal);
    });
}

function calculateOrderTotal() {
    let total = 0;
    document.querySelectorAll('#orderProducts .order-product').forEach(product => {
        const select = product.querySelector('.product-select');
        const quantity = product.querySelector('.product-quantity').value;

        if (select.selectedIndex > 0 && quantity > 0) {
            const price = parseFloat(select.selectedOptions[0].dataset.price);
            total += price * quantity;
        }
    });

    document.getElementById('orderTotal').textContent = total.toFixed(2);
}

function calculateSaleTotal() {
    let total = 0;
    document.querySelectorAll('#saleProducts .sale-product').forEach(product => {
        const select = product.querySelector('.product-select');
        const quantity = product.querySelector('.product-quantity').value;

        if (select.selectedIndex > 0 && quantity > 0) {
            const price = parseFloat(select.selectedOptions[0].dataset.price);
            total += price * quantity;
        }
    });

    document.getElementById('saleTotal').textContent = total.toFixed(2);
}

function calculateSupplierOrderTotal() {
    let total = 0;
    document.querySelectorAll('#orderSupplierProducts .supplier-order-product').forEach(product => {
        const quantity = product.querySelector('.product-quantity').value;
        const price = product.querySelector('.product-price').value;

        if (quantity > 0 && price > 0) {
            total += price * quantity;
        }
    });

    document.getElementById('supplierOrderTotal').textContent = total.toFixed(2);
}

// Funciones de acción
async function viewOrderDetails(id) {
    try {
        const response = await fetchWithCORS(`${API_URL}/pedidos/${id}/productos`);
        const details = await response.json();

        const modalTitle = document.getElementById('modalTitle');
        modalTitle.textContent = `Detalles del Pedido #${id}`;

        const modalContent = document.getElementById('modalContent');

        if (details.length === 0) {
            modalContent.innerHTML = '<p>No hay productos en este pedido.</p>';
        } else {
            let tableHTML = `
                <table>
                    <thead>
                        <tr>
                            <th>Producto ID</th>
                            <th>Cantidad</th>
                            <th>Precio</th>
                            <th>Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            let total = 0;
            details.forEach(detail => {
                tableHTML += `
                    <tr>
                        <td>${detail.id_producto}</td>
                        <td>${detail.cantidad}</td>
                        <td>$${detail.precio_unitario.toFixed(2)}</td>
                        <td>$${detail.subtotal.toFixed(2)}</td>
                    </tr>
                `;
                total += detail.subtotal;
            });

            tableHTML += `
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="3" style="text-align: right;"><strong>Total:</strong></td>
                            <td>$${total.toFixed(2)}</td>
                        </tr>
                    </tfoot>
                </table>
            `;

            modalContent.innerHTML = tableHTML;
        }

        document.getElementById('modal').style.display = 'block';

        // Cerrar modal al hacer clic en X
        document.querySelector('.close').addEventListener('click', () => {
            document.getElementById('modal').style.display = 'none';
        });

    } catch (error) {
        console.error('Error al cargar detalles del pedido:', error);
        showMessage('Error al cargar detalles del pedido', true);
    }
}

// Función similar a viewOrderDetails para ventas
function viewSaleDetails(id) {
    // Implementación similar a viewOrderDetails
}

// Función similar a viewOrderDetails para órdenes de proveedor
function viewSupplierOrderDetails(id) {
    // Implementación similar a viewOrderDetails
}

async function cancelOrder(id) {
    if (confirm(`¿Está seguro de cancelar el pedido #${id}?`)) {
        try {
            const response = await fetchWithCORS(`${API_URL}/pedidos/${id}/cancelar`, {
                method: 'POST'
            });

            if (response.ok) {
                loadOrders();
                showMessage('Pedido cancelado correctamente');
            } else {
                const error = await response.json();
                showMessage(`Error: ${error.error}`, true);
            }
        } catch (error) {
            console.error('Error al cancelar pedido:', error);
            showMessage('Error al cancelar pedido', true);
        }
    }
}

// Función similar a cancelOrder para ventas
function cancelSale(id) {
    // Implementación similar a cancelOrder
}

// Función similar a cancelOrder para órdenes de proveedor
function cancelSupplierOrder(id) {
    // Implementación similar a cancelOrder
}

async function receiveSupplierOrder(id) {
    if (confirm(`¿Está seguro de marcar como recibida la orden #${id}?`)) {
        try {
            const response = await fetchWithCORS(`${API_URL}/ordenes/${id}/recibir`, {
                method: 'POST'
            });

            if (response.ok) {
                loadSupplierOrders();
                loadProducts(); // Actualizar stock
                showMessage('Orden marcada como recibida correctamente');
            } else {
                const error = await response.json();
                showMessage(`Error: ${error.error}`, true);
            }
        } catch (error) {
            console.error('Error al recibir orden:', error);
            showMessage('Error al recibir orden', true);
        }
    }
}

// Mostrar mensajes
function showMessage(message, isError = false) {
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modalTitle');
    const modalContent = document.getElementById('modalContent');

    modalTitle.textContent = isError ? 'Error' : 'Mensaje';
    modalContent.innerHTML = `<p class="${isError ? 'error' : 'success'}">${message}</p>`;

    modal.style.display = 'block';

    // Cerrar modal al hacer clic en X
    document.querySelector('.close').addEventListener('click', () => {
        modal.style.display = 'none';
    });

    // Cerrar modal automáticamente después de 3 segundos
    setTimeout(() => {
        modal.style.display = 'none';
    }, 3000);
}