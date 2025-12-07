# File with duplicated code for testing jscpd

def process_user_data(user):
    """Process user data - contains duplicated validation logic."""
    errors = []

    # Duplicated validation block 1
    if not user.get("name"):
        errors.append("Name is required")
    if not user.get("email"):
        errors.append("Email is required")
    if not user.get("password"):
        errors.append("Password is required")
    if user.get("age") and user.get("age") < 18:
        errors.append("User must be 18 or older")
    if user.get("email") and "@" not in user.get("email"):
        errors.append("Invalid email format")

    if errors:
        return {"success": False, "errors": errors}

    return {"success": True, "data": user}


def process_admin_data(admin):
    """Process admin data - DUPLICATED validation logic from process_user_data."""
    errors = []

    # Duplicated validation block 1 (copy)
    if not admin.get("name"):
        errors.append("Name is required")
    if not admin.get("email"):
        errors.append("Email is required")
    if not admin.get("password"):
        errors.append("Password is required")
    if admin.get("age") and admin.get("age") < 18:
        errors.append("User must be 18 or older")
    if admin.get("email") and "@" not in admin.get("email"):
        errors.append("Invalid email format")

    if errors:
        return {"success": False, "errors": errors}

    return {"success": True, "data": admin}


def validate_customer_input(customer):
    """Validate customer - MORE DUPLICATED validation logic."""
    errors = []

    # Duplicated validation block 1 (another copy)
    if not customer.get("name"):
        errors.append("Name is required")
    if not customer.get("email"):
        errors.append("Email is required")
    if not customer.get("password"):
        errors.append("Password is required")
    if customer.get("age") and customer.get("age") < 18:
        errors.append("User must be 18 or older")
    if customer.get("email") and "@" not in customer.get("email"):
        errors.append("Invalid email format")

    if errors:
        return {"success": False, "errors": errors}

    return {"success": True, "data": customer}


def create_order(order_data):
    """Create order with duplicated processing logic."""
    result = {"items": [], "total": 0}

    # Duplicated order processing block
    for item in order_data.get("items", []):
        price = item.get("price", 0)
        quantity = item.get("quantity", 1)
        subtotal = price * quantity

        if item.get("discount"):
            discount = item.get("discount")
            if discount.get("type") == "percentage":
                subtotal = subtotal * (1 - discount.get("value", 0) / 100)
            elif discount.get("type") == "fixed":
                subtotal = subtotal - discount.get("value", 0)

        result["items"].append({
            "name": item.get("name"),
            "price": price,
            "quantity": quantity,
            "subtotal": subtotal
        })
        result["total"] += subtotal

    return result


def update_order(order_data):
    """Update order - DUPLICATED processing logic from create_order."""
    result = {"items": [], "total": 0}

    # Duplicated order processing block (copy)
    for item in order_data.get("items", []):
        price = item.get("price", 0)
        quantity = item.get("quantity", 1)
        subtotal = price * quantity

        if item.get("discount"):
            discount = item.get("discount")
            if discount.get("type") == "percentage":
                subtotal = subtotal * (1 - discount.get("value", 0) / 100)
            elif discount.get("type") == "fixed":
                subtotal = subtotal - discount.get("value", 0)

        result["items"].append({
            "name": item.get("name"),
            "price": price,
            "quantity": quantity,
            "subtotal": subtotal
        })
        result["total"] += subtotal

    return result
