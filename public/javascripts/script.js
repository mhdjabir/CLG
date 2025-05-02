function openNav() {
    document.getElementById("mySidenav").classList.add("open");
    document.getElementById("overlay").classList.add("show");
}

function closeNav() {
    document.getElementById("mySidenav").classList.remove("open");
    document.getElementById("overlay").classList.remove("show");
}

function addToCart(prodId) {
    $.ajax({
        url: '/add-to-cart/' + prodId,
        method: 'GET',
        success: function(response) {
            if (response.redirect) {
                window.location.href = response.redirect;
            } else if (response.success) {
                alert('Product successfully added to cart!');
                location.reload(); // Refresh the page after adding to cart
            }
        },
        error: function(xhr, status, error) {
            console.error('Error adding product to cart:', error);
            alert('Failed to add product to cart. Please try again.');
        }
    });
}

function updateTotalPrice() {
    let total = 0;
    document.querySelectorAll('tr[id^="product-row-"]').forEach(row => {
        const price = parseFloat(row.querySelector('.align-middle:nth-child(4)').textContent.replace('₹', ''));
        const quantity = parseInt(row.querySelector('.quantity-display').textContent);
        total += price * quantity;
    });


    if (total > 1000) {
        total -= 99;
        document.getElementById('discount-message').textContent = 'You got ₹99 discount! You ordered more than ₹1000.';
    } else {
        document.getElementById('discount-message').textContent = '';
    }

    document.getElementById('total-price').textContent = total.toFixed(2);
}

function changeQuantity(productId, userId, count) {
    $.ajax({
        url: '/change-product-quantity',
        method: 'POST',
        data: {
            productId: productId,
            userId: userId,
            count: count
        },
        success: (response) => {
            if (response.success) {
                location.reload(); // Refresh the page after quantity change
            } else {
                alert('Failed to update quantity');
            }
        },
        error: () => {
            alert('An error occurred while updating the quantity');
        }
    });
}

function removeProduct(productId, userId) {
    $.ajax({
        url: '/remove-product',
        method: 'POST',
        data: {
            productId: productId,
            userId: userId
        },
        success: (response) => {
            if (response.success) {
                location.reload(); // Refresh the page after removing the product
            } else {
                alert('Failed to remove product');
            }
        },
        error: () => {
            alert('An error occurred while removing the product');
        }
    });
}

// Add this function to check delivery status
function checkDeliveryStatus() {
    const deliveryInfoElements = document.querySelectorAll('[data-expected-delivery]');
    
    deliveryInfoElements.forEach(element => {
        const expectedDelivery = new Date(element.dataset.expectedDelivery);
        const now = new Date();
        const statusBadge = element.querySelector('.delivery-status-badge');
        const mainStatusBadge = document.querySelector('.status-badge');
        
        if (now >= expectedDelivery) {
            if (statusBadge) {
                statusBadge.textContent = 'Delivered';
                statusBadge.classList.remove('bg-info');
                statusBadge.classList.add('bg-success');
            }
            if (mainStatusBadge) {
                mainStatusBadge.textContent = 'Delivered';
                mainStatusBadge.className = 'status-badge Delivered';
            }
            
            // Update status in database
            const orderId = element.dataset.orderId;
            updateDeliveryStatus(orderId);
        }
    });
}

// Function to update delivery status in database
async function updateDeliveryStatus(orderId) {
    try {
        const response = await fetch(`/update-delivery-status/${orderId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                status: 'Delivered',
                trackingStatus: 'Delivered'
            })
        });
        
        const result = await response.json();
        if (!result.success) {
            console.error('Failed to update delivery status');
        }
    } catch (err) {
        console.error('Error updating delivery status:', err);
    }
}

// Check delivery status every minute
document.addEventListener('DOMContentLoaded', function() {
    checkDeliveryStatus();
    setInterval(checkDeliveryStatus, 60000);
});

document.addEventListener('DOMContentLoaded', updateTotalPrice);

document.addEventListener('DOMContentLoaded', function() {
    const deliveryForm = document.getElementById('deliveryForm');
    if (deliveryForm) {
        deliveryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(deliveryForm);
            const data = Object.fromEntries(formData.entries());
            
            try {
                const orderId = window.location.pathname.split('/').pop();
                const response = await fetch(`/admin/assign-delivery/${orderId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });

                const result = await response.json();
                if (result.success) {
                    location.reload();
                } else {
                    alert('Failed to assign delivery partner');
                }
            } catch (err) {
                console.error('Error:', err);
                alert('An error occurred while assigning delivery partner');
            }
        });
    }
});

// Add this to your existing script file
document.addEventListener('DOMContentLoaded', function() {
    const statusUpdateForm = document.getElementById('statusUpdateForm');
    if (statusUpdateForm) {
        statusUpdateForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(statusUpdateForm);
            const status = formData.get('status');
            
            try {
                const orderId = window.location.pathname.split('/').pop();
                const response = await fetch(`/admin/update-order-status/${orderId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ status })
                });

                const result = await response.json();
                if (result.success) {
                    // Update the status badge without reloading
                    const statusBadge = document.querySelector('.status-badge');
                    if (statusBadge) {
                        statusBadge.textContent = status;
                        statusBadge.className = `status-badge ${status}`;
                    }
                    // Show success message
                    alert('Order status updated successfully');
                } else {
                    alert('Failed to update order status');
                }
            } catch (err) {
                console.error('Error:', err);
                alert('An error occurred while updating order status');
            }
        });
    }
});

// Add this script at the end of view-products.hbs
function deleteProduct(productId) {
    if(confirm('Are you sure you want to delete this product?')) {
        fetch(`/admin/delete-product/${productId}`, {
            method: 'DELETE',
        })
        .then(response => response.json())
        .then(data => {
            if(data.success) {
                location.reload();
            } else {
                alert('Failed to delete product');
            }
        })
        .catch(err => {
            console.error('Error:', err);
            alert('Error deleting product');
        });
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // Product search functionality
    const searchProducts = document.getElementById('searchProducts');
    if(searchProducts) {
        searchProducts.addEventListener('input', function(e) {
            const searchText = e.target.value.toLowerCase();
            filterTable('.product-row', '.product-name', searchText);
        });
    }

    // Category filter functionality
    const categoryFilter = document.getElementById('categoryFilter');
    if(categoryFilter) {
        categoryFilter.addEventListener('change', function(e) {
            const category = e.target.value.toLowerCase();
            filterTable('.product-row', '.badge', category);
        });
    }

    // User search functionality
    const searchUsers = document.getElementById('searchUsers');
    if(searchUsers) {
        searchUsers.addEventListener('input', function(e) {
            const searchText = e.target.value.toLowerCase();
            filterTable('.user-row', '.user-name', searchText);
        });
    }

    // Order search functionality
    const searchOrders = document.getElementById('searchOrders');
    if(searchOrders) {
        searchOrders.addEventListener('input', function(e) {
            const searchText = e.target.value.toLowerCase();
            filterTable('.order-row', '.order-id', searchText);
        });
    }
});

// Generic table filter function
function filterTable(rowClass, searchClass, searchText) {
    const rows = document.querySelectorAll(rowClass);
    rows.forEach(row => {
        const searchContent = row.querySelector(searchClass).textContent.toLowerCase();
        row.style.display = searchContent.includes(searchText) ? '' : 'none';
    });
}

// Edit product function
function editProduct(productId) {
    window.location.href = `/admin/edit-product/${productId}`;
}

// Delete product function
function confirmDelete(productId, productName) {
    const modal = new bootstrap.Modal(document.getElementById('deleteModal'));
    document.getElementById('productName').textContent = productName;
    
    document.getElementById('confirmDelete').onclick = function() {
        deleteProduct(productId);
        modal.hide();
    };
    
    modal.show();
}

function deleteProduct(productId) {
    fetch(`/admin/delete-product/${productId}`, {
        method: 'DELETE'
    })
    .then(response => response.json())
    .then(data => {
        if(data.success) {
            location.reload();
        } else {
            alert('Failed to delete product');
        }
    })
    .catch(err => {
        console.error('Error:', err);
        alert('Error deleting product');
    });
}

