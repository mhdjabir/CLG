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

// Call updateTotalPrice on page load to initialize the total
document.addEventListener('DOMContentLoaded', updateTotalPrice);


