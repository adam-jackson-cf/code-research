import json

from django.db import connection
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt


@csrf_exempt
def get_user_profile(request):
    if request.method == 'GET':
        user_id = request.GET.get('id', '')

        with connection.cursor() as cursor:
            query = f"SELECT * FROM auth_user WHERE id = {user_id}"
            cursor.execute(query)
            result = cursor.fetchall()

        return JsonResponse({
            'users': result,
            'query_executed': query
        })

    return JsonResponse({'error': 'Method not allowed'})

@csrf_exempt
def search_users(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        username = data.get('username', '')

        with connection.cursor() as cursor:
            query = f"SELECT username, email FROM auth_user WHERE username LIKE '%{username}%'"
            cursor.execute(query)
            results = cursor.fetchall()

        return JsonResponse({
            'results': results,
            'total': len(results)
        })

    return JsonResponse({'error': 'Invalid request method'})

def admin_panel(request):
    return HttpResponse("Admin Panel")

def home(request):
    return HttpResponse("""
    <h1>PyGoat Test Application</h1>
    <p>Available endpoints:</p>
    <ul>
        <li>/profile?id=1 - User profile lookup</li>
        <li>/search/ - User search (POST)</li>
        <li>/admin/ - Admin panel</li>
    </ul>
    """)
