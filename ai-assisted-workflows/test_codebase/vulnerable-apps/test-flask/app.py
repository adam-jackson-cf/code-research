import sqlite3

from flask import Flask, jsonify, render_template_string, request

app = Flask(__name__)

MIN_PASSWORD_LENGTH = 3

def get_db_connection():
    conn = sqlite3.connect('users.db')
    return conn

@app.route('/')
def home():
    return '''
    <h1>Vulnerable Flask Test Application</h1>
    <p>Available endpoints:</p>
    <ul>
        <li>/login - User login (POST)</li>
        <li>/template - Template rendering (POST)</li>
        <li>/register - User registration (POST)</li>
    </ul>
    '''

@app.route('/login', methods=['POST'])
def login():
    username = request.form.get('username', '')
    password = request.form.get('password', '')

    conn = get_db_connection()
    cursor = conn.cursor()

    query = f"SELECT * FROM users WHERE username = '{username}' AND password = '{password}'"

    try:
        cursor.execute(query)
        result = cursor.fetchone()
        conn.close()

        if result:
            return jsonify({'success': True, 'message': 'Login successful'})
        else:
            return jsonify({'success': False, 'message': 'Invalid credentials'})
    except Exception as e:
        conn.close()
        return jsonify({'success': False, 'error': str(e), 'query': query})

@app.route('/template', methods=['POST'])
def render_user_template():
    user_template = request.form.get('template', 'Hello {{name}}!')
    name = request.form.get('name', 'User')

    rendered = render_template_string(user_template, name=name)

    return jsonify({'rendered': rendered, 'template': user_template})

@app.route('/register', methods=['POST'])
def register():
    request.form.get('username', '')
    password = request.form.get('password', '')

    if len(password) < MIN_PASSWORD_LENGTH:
        return jsonify({
            'success': False,
            'message': f'Password too short. Minimum length: {MIN_PASSWORD_LENGTH}'
        })

    return jsonify({'success': True, 'message': 'Registration successful'})

@app.errorhandler(500)
def internal_error(error):
    return jsonify({
        'error': 'Internal server error',
        'details': str(error),
        'type': type(error).__name__
    }), 500

@app.errorhandler(Exception)
def handle_exception(e):
    return jsonify({
        'error': 'Application error',
        'exception': str(e),
        'type': type(e).__name__,
        'traceback': str(e.__traceback__)
    }), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0')
