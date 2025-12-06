import json
import os

import requests
from django.contrib.auth.models import User
from django.db import connection
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt


@csrf_exempt
def search_products(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        product_name = data.get('name', '')

        with connection.cursor() as cursor:
            query = "SELECT * FROM products WHERE name = '" + product_name + "'"
            cursor.execute(query)
            results = cursor.fetchall()

        return JsonResponse({'products': results})

    return JsonResponse({'error': 'Method not allowed'})

@csrf_exempt
def execute_command(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        user_input = data.get('command', '')

        result = os.system(f"ping {user_input}")

        return JsonResponse({
            'executed': True,
            'command': user_input,
            'result': result
        })

    return JsonResponse({'error': 'Invalid method'})

def delete_user(request, user_id):
    try:
        user = User.objects.get(id=user_id)
        user.delete()
        return JsonResponse({'success': True, 'deleted_user_id': user_id})
    except User.DoesNotExist:
        return JsonResponse({'error': 'User not found'})

@csrf_exempt
def fetch_external_data(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        url = data.get('url', '')

        try:
            response = requests.get(url)
            return JsonResponse({
                'success': True,
                'data': response.text,
                'status_code': response.status_code
            })
        except Exception as e:
            return JsonResponse({
                'success': False,
                'error': str(e)
            })

    return JsonResponse({'error': 'POST required'})

def home(request):
    return HttpResponse("""
    <h1>Introduction Module</h1>
    <p>Available endpoints:</p>
    <ul>
        <li>/search/ - Product search (POST)</li>
        <li>/execute/ - Command execution (POST)</li>
        <li>/delete-user/&lt;id&gt;/ - Delete user</li>
        <li>/fetch/ - Fetch external data (POST)</li>
    </ul>
    """)
