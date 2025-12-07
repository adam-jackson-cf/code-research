# File with high cyclomatic complexity for testing lizard
def process_order(order, user, payment, shipping, discount=None, coupon=None):
    """
    Process an order - INTENTIONALLY complex function for testing.
    This function has high cyclomatic complexity.
    """
    result = {"status": "unknown", "errors": []}

    # Complex nested conditionals
    if order is None:
        result["status"] = "error"
        result["errors"].append("Order is required")
        return result

    if user is None:
        result["status"] = "error"
        result["errors"].append("User is required")
        return result

    if not user.get("active"):
        if user.get("suspended"):
            result["status"] = "error"
            result["errors"].append("User is suspended")
            return result
        elif user.get("pending_verification"):
            result["status"] = "error"
            result["errors"].append("User pending verification")
            return result
        else:
            result["status"] = "error"
            result["errors"].append("User is not active")
            return result

    if payment is None:
        result["status"] = "error"
        result["errors"].append("Payment is required")
        return result

    payment_type = payment.get("type")
    if payment_type == "credit_card":
        if not payment.get("card_number"):
            result["errors"].append("Card number required")
        if not payment.get("expiry"):
            result["errors"].append("Expiry required")
        if not payment.get("cvv"):
            result["errors"].append("CVV required")
    elif payment_type == "paypal":
        if not payment.get("email"):
            result["errors"].append("PayPal email required")
    elif payment_type == "bank_transfer":
        if not payment.get("account_number"):
            result["errors"].append("Account number required")
        if not payment.get("routing_number"):
            result["errors"].append("Routing number required")
    elif payment_type == "crypto":
        if not payment.get("wallet_address"):
            result["errors"].append("Wallet address required")
    else:
        result["errors"].append("Invalid payment type")

    if result["errors"]:
        result["status"] = "error"
        return result

    if shipping is None:
        result["status"] = "error"
        result["errors"].append("Shipping is required")
        return result

    shipping_method = shipping.get("method")
    if shipping_method == "express":
        if order.get("weight", 0) > 50:
            result["errors"].append("Express not available for heavy items")
    elif shipping_method == "overnight":
        if order.get("weight", 0) > 20:
            result["errors"].append("Overnight not available for heavy items")
        if not shipping.get("address", {}).get("zip"):
            result["errors"].append("ZIP code required for overnight")
    elif shipping_method == "international":
        if not shipping.get("customs_info"):
            result["errors"].append("Customs info required")
        if not shipping.get("address", {}).get("country"):
            result["errors"].append("Country required for international")

    if result["errors"]:
        result["status"] = "error"
        return result

    total = order.get("subtotal", 0)

    if discount:
        if discount.get("type") == "percentage":
            total = total * (1 - discount.get("value", 0) / 100)
        elif discount.get("type") == "fixed":
            total = total - discount.get("value", 0)

    if coupon:
        if coupon.get("type") == "percentage":
            total = total * (1 - coupon.get("value", 0) / 100)
        elif coupon.get("type") == "fixed":
            total = total - coupon.get("value", 0)
        elif coupon.get("type") == "free_shipping":
            shipping["cost"] = 0

    if total < 0:
        total = 0

    result["status"] = "success"
    result["total"] = total
    return result


def another_complex_function(data, options, config):
    """Another complex function to increase file complexity."""
    output = []

    for item in data:
        if item.get("type") == "A":
            if item.get("status") == "active":
                if item.get("priority") == "high":
                    output.append({"action": "process_immediately", "item": item})
                elif item.get("priority") == "medium":
                    output.append({"action": "queue", "item": item})
                else:
                    output.append({"action": "batch", "item": item})
            elif item.get("status") == "pending":
                if options.get("include_pending"):
                    output.append({"action": "review", "item": item})
            else:
                if config.get("log_inactive"):
                    output.append({"action": "log", "item": item})
        elif item.get("type") == "B":
            if item.get("status") == "active":
                output.append({"action": "transform", "item": item})
            else:
                output.append({"action": "skip", "item": item})
        elif item.get("type") == "C":
            if options.get("process_type_c"):
                output.append({"action": "special", "item": item})

    return output
