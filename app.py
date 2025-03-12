from flask import Flask, render_template, request, redirect, url_for, flash, jsonify, session
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

# Initialize Flask App
app = Flask(__name__)

# Determine which database to use
if os.getenv('FLASK_ENV') == 'debug':  # When running app locally
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('PUBLIC_DATABASE_URL')
else:  # When running in production
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('LOCAL_DATABASE_URL')

# Fix PyMySQL compatibility
app.config['SQLALCHEMY_DATABASE_URI'] = app.config['SQLALCHEMY_DATABASE_URI'].replace("mysql://", "mysql+pymysql://")

app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'supersecretkey')

# Initialize Database
db = SQLAlchemy(app)
migrate = Migrate(app, db)

# Flask-Login Setup
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = "login"

# User Model
class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    theme_preference = db.Column(db.String(10), default="light")

# Class Model
class Class(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    teacher_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    students = db.relationship('Student', backref='class_', lazy=True)

# Student Model
class Student(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    first_name = db.Column(db.String(50), nullable=False)
    last_name = db.Column(db.String(50), nullable=False)
    class_id = db.Column(db.Integer, db.ForeignKey('class.id'), nullable=False)

# Initialize database
with app.app_context():
    db.create_all()

# Flask-Login Loader
@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Home Route
@app.route('/')
def home():
    return render_template("index.html") if not current_user.is_authenticated else redirect(url_for('dashboard'))

# Login Route
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        user = User.query.filter_by(username=username).first()

        if user and check_password_hash(user.password, password):
            login_user(user)
            return redirect(url_for('dashboard'))
        flash('Invalid username or password')

    return render_template('auth/login.html')

# Register Route
@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')

        if User.query.filter_by(username=username).first():
            flash('Username already exists. Choose another one.')
            return redirect(url_for('register'))

        hashed_password = generate_password_hash(password, method='pbkdf2:sha256')
        new_user = User(username=username, password=hashed_password)
        db.session.add(new_user)
        db.session.commit()

        return redirect(url_for('login'))

    return render_template('auth/register.html')

# Logout Route
@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('home'))

# Dashboard Route
@app.route('/dashboard')
@login_required
def dashboard():
    teacher_classes = Class.query.filter_by(teacher_id=current_user.id).all()
    return render_template('classes/dashboard.html', classes=teacher_classes)

@app.route("/get_theme", methods=["GET"])
@login_required
def get_theme():
    return jsonify({"theme": current_user.theme_preference})

@app.route("/set_theme", methods=["POST"])
@login_required
def set_theme():
    data = request.json
    if "theme" in data:
        current_user.theme_preference = data["theme"]
        db.session.commit()
        return jsonify({"success": True}), 200
    return jsonify({"success": False, "error": "Invalid request"}), 400

# Create Class Route
@app.route('/create_class', methods=['POST'])
@login_required
def create_class():
    data = request.get_json()
    name = data.get("class_name", "").strip()  # Ensure it's a string and remove spaces

    if not name:
        return jsonify({"success": False, "error": "Class name cannot be empty"}), 400

    students_list = data.get("students", [])

    new_class = Class(name=name, teacher_id=current_user.id)
    db.session.add(new_class)
    db.session.commit()

    # Add students to class
    for student in students_list:
        last_name = student.get("last_name", "").strip()
        first_name = student.get("first_name", "").strip()
        
        if last_name and first_name:
            new_student = Student(first_name=first_name, last_name=last_name, class_id=new_class.id)
            db.session.add(new_student)

    db.session.commit()

    return jsonify({"success": True})


# View Class Route
@app.route('/class/<int:class_id>')
@login_required
def class_view(class_id):
    class_ = Class.query.get_or_404(class_id)
    students = Student.query.filter_by(class_id=class_id).all()
    return render_template('classes/class_view.html', class_=class_, students=students)

# Pick a Random Student Route
@app.route('/pick_student/<int:class_id>', methods=['GET'])
@login_required
def pick_student(class_id):
    class_ = Class.query.filter_by(id=class_id, teacher_id=current_user.id).first()
    if not class_:
        return jsonify({"error": "Class not found"}), 404

    students = Student.query.filter_by(class_id=class_id).all()
    student_names = [f"{s.first_name} {s.last_name}" for s in students]

    return jsonify({"students": student_names})


@app.route('/get_class/<int:class_id>', methods=['GET'])
@login_required
def get_class(class_id):
    class_ = Class.query.filter_by(id=class_id, teacher_id=current_user.id).first()
    if not class_:
        return jsonify({"success": False, "error": "Class not found"}), 404

    students = Student.query.filter_by(class_id=class_.id).all()
    students_list = [{"id": s.id, "first_name": s.first_name, "last_name": s.last_name} for s in students]

    return jsonify({"success": True, "class_name": class_.name, "students": students_list})

@app.route('/edit_class/<int:class_id>', methods=['POST'])
@login_required
def edit_class(class_id):
    data = request.get_json()
    new_name = data.get("class_name", "").strip()
    updated_students = data.get("students", [])
    deleted_students = data.get("deleted_students", [])

    class_ = Class.query.filter_by(id=class_id, teacher_id=current_user.id).first()
    if not class_:
        return jsonify({"success": False, "error": "Class not found"}), 404

    if new_name:
        class_.name = new_name

    # Get existing students
    existing_students = {s.id: s for s in Student.query.filter_by(class_id=class_.id).all()}

    new_student_ids = set()

    for student in updated_students:
        student_id = student.get("id")
        last_name = student.get("last_name").strip()
        first_name = student.get("first_name").strip()

        if student_id:  # Update existing student
            if student_id in existing_students:
                existing_students[student_id].first_name = first_name
                existing_students[student_id].last_name = last_name
                new_student_ids.add(student_id)
        else:  # New student
            new_student = Student(first_name=first_name, last_name=last_name, class_id=class_.id)
            db.session.add(new_student)

    # Delete explicitly removed students
    for student_id in deleted_students:
        student = Student.query.get(student_id)
        if student and student.class_id == class_.id:
            db.session.delete(student)

    db.session.commit()
    return jsonify({"success": True})


@app.route('/delete_class/<int:class_id>', methods=['POST'])
@login_required
def delete_class(class_id):
    class_ = Class.query.filter_by(id=class_id, teacher_id=current_user.id).first()

    if class_:
        # Delete all students in the class first
        Student.query.filter_by(class_id=class_.id).delete()

        # Delete the class
        db.session.delete(class_)
        db.session.commit()
        return jsonify({"success": True})

    return jsonify({"success": False, "error": "Class not found"}), 404

# Run the Flask App
if __name__ == '__main__':
    app.run(debug=True)
