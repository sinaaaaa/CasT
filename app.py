from flask import Flask, request, jsonify, render_template, redirect, url_for, session, send_from_directory, Response
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from datetime import datetime
import os
from functools import wraps
import json
from openai import OpenAI
import re
from sqlalchemy.exc import IntegrityError
from collections import defaultdict, deque
import gzip

app = Flask(__name__, static_folder='webgl/coding-game', static_url_path='/game')
CORS(app)
app.secret_key = os.urandom(24)  # For session management

# Database configuration - use environment variable for production
database_url = os.environ.get('DATABASE_URL', 'sqlite:///coding_block.db')
if database_url.startswith('postgres://'):
    database_url = database_url.replace('postgres://', 'postgresql://', 1)
app.config['SQLALCHEMY_DATABASE_URI'] = database_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# Models
class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(120), nullable=False)
    role = db.Column(db.String(20), nullable=False)  # 'student' or 'teacher'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    assessments = db.relationship('Assessment', backref='student', lazy=True)
    feedback_received = db.relationship('Feedback', 
                                      foreign_keys='Feedback.student_id',
                                      backref='student', 
                                      lazy=True)
    feedback_given = db.relationship('Feedback', 
                                   foreign_keys='Feedback.teacher_id',
                                   backref='teacher', 
                                   lazy=True)
    game_logs = db.relationship('GameLog', backref='user', lazy=True)

class Assessment(db.Model):
    __tablename__ = 'assessments'
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    level = db.Column(db.String(50), nullable=False)
    decomposition_score = db.Column(db.Integer)
    pattern_recognition_score = db.Column(db.Integer)
    algorithmic_thinking_score = db.Column(db.Integer)
    debugging_score = db.Column(db.Integer)
    abstraction_score = db.Column(db.Integer)
    total_score = db.Column(db.Integer)
    action_log = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    gpt_response = db.Column(db.Text)
    ct_extra_scores = db.Column(db.Text)
    persistence_score = db.Column(db.Integer)
    creativity_score = db.Column(db.Integer)
    error_types = db.Column(db.Text)  # Store as JSON string/list
    collaboration_events = db.Column(db.Text)  # Store as JSON string/list
    number_of_attempts = db.Column(db.Integer)
    time_on_task = db.Column(db.Float)  # seconds

class Feedback(db.Model):
    __tablename__ = 'feedback'
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    teacher_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    type = db.Column(db.String(20), nullable=False)  # 'praise', 'improvement', 'suggestion'
    message = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_read = db.Column(db.Boolean, default=False)

class GameLog(db.Model):
    __tablename__ = 'game_logs'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    level = db.Column(db.String(50), nullable=False)
    score = db.Column(db.Integer)
    actions = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

# Login required decorator
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

# Add these default credentials at the top of the file after the imports
DEFAULT_TEACHER = {
    'username': 'teacher',
    'password': 'teacher123',
    'role': 'teacher'
}

DEFAULT_STUDENT = {
    'username': 'student',
    'password': 'student123',
    'role': 'student'
}

# Web routes
@app.route('/')
def index():
    if 'user_id' in session:
        user = User.query.get(session['user_id'])
        if user.role == 'teacher':
            return redirect(url_for('teacher_dashboard'))
        else:
            return redirect(url_for('student_dashboard'))
    return redirect(url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        data = request.form
        username = data.get('username')
        password = data.get('password')
        
        # Try different username formats
        user = None
        
        # Try exact username match
        user = User.query.filter_by(username=username).first()
        
        # If not found, try to extract ID from Student_ID format
        if not user and username.startswith('Student_'):
            try:
                student_id = username.replace('Student_', '')
                user = User.query.filter_by(id=student_id, role='student').first()
            except:
                pass
        
        # If still not found, try direct ID match
        if not user:
            try:
                user = User.query.filter_by(id=username, role='student').first()
            except:
                pass
        
        # Check password
        if user and (user.password == password or user.id == password):
            session['user_id'] = user.id
            if user.role == 'teacher':
                return redirect(url_for('teacher_dashboard'))
            else:
                return redirect(url_for('student_dashboard'))
        
        return render_template('login.html', error='Invalid credentials')
    
    return render_template('login.html')

@app.route('/teacher/dashboard')
@login_required
def teacher_dashboard():
    user = User.query.get(session['user_id'])
    if user.role != 'teacher':
        return redirect(url_for('login'))
    
    students = User.query.filter_by(role='student').all()
    return render_template('teacher_dashboard.html', students=students)

@app.route('/student/dashboard')
def student_dashboard():
    # Check if this is a Unity request (has user_id in query params)
    user_id_param = request.args.get('user_id')
    if user_id_param:
        # This is a Unity request, return JSON data
        student = User.query.get(user_id_param)
        if student:
            assessments = Assessment.query.filter_by(student_id=student.id).order_by(Assessment.created_at.desc()).all()
            game_logs = GameLog.query.filter_by(user_id=student.id).order_by(GameLog.created_at.desc()).all()
            unique_levels_from_logs = {log.level for log in game_logs if log.level != 'Initial'} 
            return jsonify({
                'status': 'success',
                'student': {
                    'id': student.id,
                    'username': student.username
                },
                'assessments': [{
                    'id': a.id,
                    'level': a.level,
                    'total_score': a.total_score,
                    'decomposition_score': a.decomposition_score,
                    'pattern_recognition_score': a.pattern_recognition_score,
                    'abstraction_score': a.abstraction_score,
                    'algorithmic_thinking_score': a.algorithmic_thinking_score,
                    'debugging_score': a.debugging_score,
                    'gpt_response': a.gpt_response,
                    'created_at': a.created_at.isoformat()
                } for a in assessments],
                'game_logs': [{
                    'id': log.id,
                    'level': log.level,
                    'score': log.score,
                    'actions': log.actions,
                    'created_at': log.created_at.isoformat()
                } for log in game_logs],
                'unique_levels_completed': len(unique_levels_from_logs)
            })
        return jsonify({'status': 'error', 'message': 'Student not found'}), 404
    
    # This is a web request, check session
    if 'user_id' not in session:
        return redirect(url_for('login'))
    
    user = User.query.get(session['user_id'])
    if user.role != 'student':
        return redirect(url_for('login'))
    
    # Fetch assessments and game logs for the web view
    assessments = Assessment.query.filter_by(student_id=user.id).order_by(Assessment.created_at.desc()).all()
    game_logs = GameLog.query.filter_by(user_id=user.id).order_by(GameLog.created_at.desc()).all()
    
    # Calculate unique levels completed from game_logs
    unique_levels_from_logs = set()
    if game_logs:
        for log in game_logs:
            if log.level != 'Initial':  # Ignore the initial login log
                unique_levels_from_logs.add(log.level)
    unique_levels_completed = len(unique_levels_from_logs)

    # Calculate per-level assessment aggregation
    level_assessments = defaultdict(list)
    for a in assessments:
        level_assessments[a.level].append(a)

    level_summaries = {}
    for level, level_as in level_assessments.items():
        n = len(level_as)
        if n == 0:
            continue
        level_summaries[level] = {
            'count': n,
            'avg_decomposition': sum(a.decomposition_score or 0 for a in level_as) / n,
            'avg_pattern_recognition': sum(a.pattern_recognition_score or 0 for a in level_as) / n,
            'avg_abstraction': sum(a.abstraction_score or 0 for a in level_as) / n,
            'avg_algorithmic_thinking': sum(a.algorithmic_thinking_score or 0 for a in level_as) / n,
            'avg_debugging': sum(a.debugging_score or 0 for a in level_as) / n,
        }

    return render_template('student_dashboard.html', 
                         user=user, 
                         assessments=assessments, 
                         game_logs=game_logs,
                         unique_levels_completed=unique_levels_completed,
                         level_summaries=level_summaries)

@app.route('/teacher/student/<int:student_id>')
@login_required
def view_student(student_id):
    teacher = User.query.get(session['user_id'])
    if teacher.role != 'teacher':
        return redirect(url_for('login'))
    
    student = User.query.get_or_404(student_id)
    assessments = Assessment.query.filter_by(student_id=student_id).all()
    game_logs = GameLog.query.filter_by(user_id=student_id).all()
    
    return render_template('student_details.html', 
                         student=student, 
                         assessments=assessments,
                         game_logs=game_logs)

@app.route('/student/logs')
@login_required
def student_logs():
    user = User.query.get(session['user_id'])
    if user.role != 'student':
        return redirect(url_for('login'))
    
    game_logs = GameLog.query.filter_by(user_id=user.id).all()
    assessments = Assessment.query.filter_by(student_id=user.id).all()
    
    return render_template('student_logs.html', 
                         user=user,
                         game_logs=game_logs,
                         assessments=assessments)

# API routes
@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'Username already exists'}), 400
    
    new_user = User(
        username=data['username'],
        password=data['password'],  # In production, hash the password!
        role=data['role']
    )
    
    db.session.add(new_user)
    db.session.commit()
    
    return jsonify({'message': 'User registered successfully'}), 201

@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.get_json()
    user = User.query.filter_by(username=data['username']).first()
    
    if user and user.password == data['password']:
        return jsonify({
            'message': 'Login successful',
            'user_id': user.id,
            'role': user.role
        }), 200
    
    return jsonify({'error': 'Invalid credentials'}), 401

@app.route('/api/assessment', methods=['POST'])
def save_assessment():
    try:
        data = request.get_json()
        
        new_assessment = Assessment(
            student_id=data['student_id'],
            level=data['level'],
            decomposition_score=data['decomposition_score'],
            pattern_recognition_score=data['pattern_recognition_score'],
            algorithmic_thinking_score=data['algorithmic_thinking_score'],
            debugging_score=data['debugging_score'],
            abstraction_score=data['abstraction_score'],
            total_score=data['total_score'],
            action_log=data['action_log']
        )
        
        db.session.add(new_assessment)
        db.session.commit()
        
        return jsonify({
            'status': 'success',
            'message': 'Assessment saved successfully'
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/assessments/<int:student_id>', methods=['GET'])
def get_student_assessments(student_id):
    assessments = Assessment.query.filter_by(student_id=student_id).all()
    return jsonify([{
        'id': a.id,
        'level': a.level,
        'decomposition_score': a.decomposition_score,
        'pattern_recognition_score': a.pattern_recognition_score,
        'algorithmic_thinking_score': a.algorithmic_thinking_score,
        'debugging_score': a.debugging_score,
        'total_score': a.total_score,
        'action_log': a.action_log,
        'created_at': a.created_at.isoformat()
    } for a in assessments]), 200

@app.route('/api/students', methods=['GET'])
def get_all_students():
    students = User.query.filter_by(role='student').all()
    return jsonify([{
        'id': s.id,
        'username': s.username,
        'created_at': s.created_at.isoformat()
    } for s in students]), 200

@app.route('/api/statistics', methods=['GET'])
def get_statistics():
    assessments = Assessment.query.all()
    if not assessments:
        return jsonify({
            'decomposition': 0,
            'pattern_recognition': 0,
            'algorithmic_thinking': 0,
            'debugging': 0
        })
    
    total = len(assessments)
    return jsonify({
        'decomposition': sum(a.decomposition_score for a in assessments) / total,
        'pattern_recognition': sum(a.pattern_recognition_score for a in assessments) / total,
        'algorithmic_thinking': sum(a.algorithmic_thinking_score for a in assessments) / total,
        'debugging': sum(a.debugging_score for a in assessments) / total
    })

# New API routes for feedback and analytics
@app.route('/api/feedback', methods=['POST'])
@login_required
def create_feedback():
    data = request.get_json()
    
    new_feedback = Feedback(
        student_id=data['student_id'],
        teacher_id=session['user_id'],
        type=data['type'],
        message=data['message']
    )
    
    db.session.add(new_feedback)
    db.session.commit()
    
    return jsonify({'message': 'Feedback created successfully'}), 201

@app.route('/api/feedback/<int:student_id>', methods=['GET'])
@login_required
def get_student_feedback(student_id):
    feedback = Feedback.query.filter_by(student_id=student_id).order_by(Feedback.created_at.desc()).all()
    return jsonify([{
        'id': f.id,
        'type': f.type,
        'message': f.message,
        'created_at': f.created_at.isoformat(),
        'is_read': f.is_read
    } for f in feedback]), 200

@app.route('/api/feedback/<int:feedback_id>/read', methods=['POST'])
@login_required
def mark_feedback_read(feedback_id):
    feedback = Feedback.query.get_or_404(feedback_id)
    feedback.is_read = True
    db.session.commit()
    return jsonify({'message': 'Feedback marked as read'}), 200

@app.route('/api/analytics/overview', methods=['GET'])
@login_required
def get_analytics_overview():
    total_students = User.query.filter_by(role='student').count()
    total_assessments = Assessment.query.count()
    
    # Calculate average scores
    assessments = Assessment.query.all()
    if not assessments:
        return jsonify({
            'total_students': 0,
            'total_assessments': 0,
            'average_scores': {
                'decomposition': 0,
                'pattern_recognition': 0,
                'algorithmic_thinking': 0,
                'debugging': 0
            }
        })
    
    total = len(assessments)
    average_scores = {
        'decomposition': sum(a.decomposition_score for a in assessments) / total,
        'pattern_recognition': sum(a.pattern_recognition_score for a in assessments) / total,
        'algorithmic_thinking': sum(a.algorithmic_thinking_score for a in assessments) / total,
        'debugging': sum(a.debugging_score for a in assessments) / total
    }
    
    return jsonify({
        'total_students': total_students,
        'total_assessments': total_assessments,
        'average_scores': average_scores
    })

@app.route('/api/analytics/student/<int:student_id>', methods=['GET'])
@login_required
def get_student_analytics(student_id):
    student = User.query.get_or_404(student_id)
    assessments = Assessment.query.filter_by(student_id=student_id).order_by(Assessment.created_at).all()
    
    if not assessments:
        return jsonify({
            'student_name': student.username,
            'total_assessments': 0,
            'progress': [],
            'skill_distribution': {
                'decomposition': {0: 0, 1: 0, 2: 0, 3: 0, 4: 0},
                'pattern_recognition': {0: 0, 1: 0, 2: 0, 3: 0, 4: 0},
                'algorithmic_thinking': {0: 0, 1: 0, 2: 0, 3: 0, 4: 0},
                'debugging': {0: 0, 1: 0, 2: 0, 3: 0, 4: 0}
            }
        })
    
    # Calculate progress over time
    progress = [{
        'date': a.created_at.isoformat(),
        'total_score': a.total_score,
        'decomposition': a.decomposition_score,
        'pattern_recognition': a.pattern_recognition_score,
        'algorithmic_thinking': a.algorithmic_thinking_score,
        'debugging': a.debugging_score
    } for a in assessments]
    
    # Calculate skill distribution
    skill_distribution = {
        'decomposition': {0: 0, 1: 0, 2: 0, 3: 0, 4: 0},
        'pattern_recognition': {0: 0, 1: 0, 2: 0, 3: 0, 4: 0},
        'algorithmic_thinking': {0: 0, 1: 0, 2: 0, 3: 0, 4: 0},
        'debugging': {0: 0, 1: 0, 2: 0, 3: 0, 4: 0}
    }
    
    for assessment in assessments:
        skill_distribution['decomposition'][assessment.decomposition_score] += 1
        skill_distribution['pattern_recognition'][assessment.pattern_recognition_score] += 1
        skill_distribution['algorithmic_thinking'][assessment.algorithmic_thinking_score] += 1
        skill_distribution['debugging'][assessment.debugging_score] += 1
    
    return jsonify({
        'student_name': student.username,
        'total_assessments': len(assessments),
        'progress': progress,
        'skill_distribution': skill_distribution
    })

@app.route('/api/analytics/comparison/<int:student1_id>/<int:student2_id>', methods=['GET'])
@login_required
def compare_students(student1_id, student2_id):
    student1 = User.query.get_or_404(student1_id)
    student2 = User.query.get_or_404(student2_id)
    
    assessments1 = Assessment.query.filter_by(student_id=student1_id).order_by(Assessment.created_at.desc()).first()
    assessments2 = Assessment.query.filter_by(student_id=student2_id).order_by(Assessment.created_at.desc()).first()
    
    if not assessments1 or not assessments2:
        return jsonify({'error': 'One or both students have no assessments'}), 404
    
    return jsonify({
        'student1': {
            'name': student1.username,
            'latest_assessment': {
                'decomposition': assessments1.decomposition_score,
                'pattern_recognition': assessments1.pattern_recognition_score,
                'algorithmic_thinking': assessments1.algorithmic_thinking_score,
                'debugging': assessments1.debugging_score,
                'total_score': assessments1.total_score
            }
        },
        'student2': {
            'name': student2.username,
            'latest_assessment': {
                'decomposition': assessments2.decomposition_score,
                'pattern_recognition': assessments2.pattern_recognition_score,
                'algorithmic_thinking': assessments2.algorithmic_thinking_score,
                'debugging': assessments2.debugging_score,
                'total_score': assessments2.total_score
            }
        }
    })

@app.route('/api/check_student/<student_id>', methods=['GET'])
def check_student(student_id):
    try:
        student_id_int = int(student_id)
        username = f'Student_{student_id_int}'
        student = User.query.filter_by(id=student_id_int, username=username, role='student').first()

        if student:
            return jsonify({
                'status': 'success',
                'message': 'Student found',
                'student': {
                    'id': student.id,
                    'username': student.username
                }
            }), 200
        else:
            try:
                new_student = User(
                    id=student_id_int,
                    username=username,
                    password=student_id,
                    role='student'
                )
                db.session.add(new_student)
                db.session.commit()
            except IntegrityError:
                db.session.rollback()
                # Student was likely created by a parallel request, fetch again
                student = User.query.filter_by(id=student_id_int, username=username, role='student').first()
                if student:
                    return jsonify({
                        'status': 'success',
                        'message': 'Student found (after duplicate creation)',
                        'student': {
                            'id': student.id,
                            'username': student.username
                        }
                    }), 200
                else:
                    return jsonify({'status': 'error', 'message': 'Could not create or find student.'}), 500
            except Exception as e:
                db.session.rollback()
                return jsonify({'status': 'error', 'message': str(e)}), 500

            # Create initial game log for the new student
            initial_log = GameLog(
                user_id=new_student.id,
                level='Initial',
                score=0,
                actions='Initial login'
            )
            db.session.add(initial_log)
            db.session.commit()

            return jsonify({
                'status': 'success',
                'message': 'New student created',
                'student': {
                    'id': new_student.id,
                    'username': new_student.username,
                    'password': student_id
                }
            }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/game_progress', methods=['POST'])
def game_progress():
    try:
        # Changed from request.get_json() to request.form to handle form data from Unity
        user_id = request.form.get('user_id')
        level = request.form.get('level')
        score = request.form.get('score')
        actions = request.form.get('actions')
        
        print(f"Received game progress: user_id={user_id}, level={level}, score={score}")
        
        # Verify student exists
        student = User.query.get(user_id)
        if not student:
            return jsonify({
                'status': 'error',
                'message': 'Student not found'
            }), 404
        
        # Create new game log entry
        new_log = GameLog(
            user_id=user_id,
            level=level,
            score=score,
            actions=actions
        )
        
        db.session.add(new_log)
        db.session.commit()
        
        # Get all logs for this student
        all_logs = GameLog.query.filter_by(user_id=user_id).order_by(GameLog.created_at.desc()).all()
        
        return jsonify({
            'status': 'success',
            'message': 'Game progress saved successfully',
            'logs': [{
                'id': log.id,
                'level': log.level,
                'score': log.score,
                'actions': log.actions,
                'created_at': log.created_at.isoformat()
            } for log in all_logs]
        })
        
    except Exception as e:
        print(f"Error in game_progress: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/get_user_logs/<user_id>', methods=['GET'])
def get_user_logs(user_id):
    try:
        # Verify student exists
        student = User.query.get(user_id)
        if not student:
            return jsonify({
                'status': 'error',
                'message': 'Student not found'
            }), 404
            
        logs = GameLog.query.filter_by(user_id=user_id).order_by(GameLog.created_at.desc()).all()
        assessments = Assessment.query.filter_by(student_id=user_id).order_by(Assessment.created_at.desc()).all()
        
        return jsonify({
            'status': 'success',
            'student': {
                'id': student.id,
                'username': student.username
            },
            'logs': [{
                'id': log.id,
                'level': log.level,
                'score': log.score,
                'actions': log.actions,
                'created_at': log.created_at.isoformat()
            } for log in logs],
            'assessments': [{
                'id': a.id,
                'level': a.level,
                'total_score': a.total_score,
                'created_at': a.created_at.isoformat()
            } for a in assessments]
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/check_panel')
@login_required
def check_panel():
    user = User.query.get(session['user_id'])
    if user.role == 'teacher':
        return redirect(url_for('teacher_dashboard'))
    else:
        return redirect(url_for('student_dashboard'))

@app.route('/teacher/panel')
@login_required
def teacher_panel():
    user = User.query.get(session['user_id'])
    if user.role != 'teacher':
        return redirect(url_for('login'))
    
    # Get all students
    students = User.query.filter_by(role='student').all()
    
    # Get statistics
    total_students = len(students)
    total_assessments = Assessment.query.count()
    
    # Get recent assessments
    recent_assessments = Assessment.query.order_by(Assessment.created_at.desc()).limit(5).all()
    
    # Get student progress
    student_progress = []
    for student in students:
        assessments = Assessment.query.filter_by(student_id=student.id).all()
        if assessments:
            avg_score = sum(a.total_score for a in assessments) / len(assessments)
            student_progress.append({
                'student': student,
                'avg_score': avg_score,
                'total_assessments': len(assessments)
            })
    
    return render_template('teacher_panel.html',
                         user=user,
                         students=students,
                         total_students=total_students,
                         total_assessments=total_assessments,
                         recent_assessments=recent_assessments,
                         student_progress=student_progress)

@app.route('/student/panel')
@login_required
def student_panel():
    return redirect(url_for('student_dashboard'))

# Add a route to create default users
@app.route('/setup_default_users')
def setup_default_users():
    # Create default teacher if not exists
    teacher = User.query.filter_by(username=DEFAULT_TEACHER['username']).first()
    if not teacher:
        teacher = User(
            username=DEFAULT_TEACHER['username'],
            password=DEFAULT_TEACHER['password'],
            role=DEFAULT_TEACHER['role']
        )
        db.session.add(teacher)
    
    # Create default student if not exists
    student = User.query.filter_by(username=DEFAULT_STUDENT['username']).first()
    if not student:
        student = User(
            username=DEFAULT_STUDENT['username'],
            password=DEFAULT_STUDENT['password'],
            role=DEFAULT_STUDENT['role']
        )
        db.session.add(student)
    
    db.session.commit()
    return "Default users created successfully!"

# Add a route to help students find their login info
@app.route('/student/login_help')
def student_login_help():
    return render_template('student_login_help.html')

def analyze_attempt(student_actions, optimal_paths, number_of_attempts=1, time_on_task=0, hints_used=0):
    error_types = []
    creativity_score = 2  # Default
    persistence_score = 2  # Default

    def normalize(path):
        return [a.strip().lower() for a in path]

    is_optimal = any(normalize(opt) == normalize(student_actions) for opt in optimal_paths if opt)
    if not is_optimal:
        min_len = min(len(opt) for opt in optimal_paths if opt) if optimal_paths and any(optimal_paths) else 0
        if len(student_actions) > min_len:
            error_types.append("Extra Moves")
        for i, act in enumerate(student_actions):
            if optimal_paths and any(optimal_paths) and i < min_len and act != optimal_paths[0][i]:
                error_types.append(f"Wrong Action at Step {i+1}")
        if (min_len > 0 and len(student_actions) == min_len + 1 and
            student_actions[-1] in ['backward', 'forward', 'turn left', 'turn right']):
            error_types.append("Off-by-One Error")
        if not error_types:
            error_types.append("Other Error")
    else:
        error_types.append("None")

    # Creativity: If not optimal but still valid, and not just random extra moves
    if not is_optimal:
        if "Extra Moves" in error_types:
            creativity_score = 3
        else:
            creativity_score = 4 if set(student_actions) - set(optimal_paths[0]) else 2
    else:
        creativity_score = 2  # Standard solution, not especially creative

    # Persistence: Based on attempts, time, hints
    try:
        number_of_attempts = int(number_of_attempts)
        hints_used = int(hints_used)
        time_on_task = float(time_on_task)
    except Exception:
        number_of_attempts = 1
        hints_used = 0
        time_on_task = 0
    if number_of_attempts == 1 and hints_used == 0:
        persistence_score = 2
    elif number_of_attempts > 1 or time_on_task > 60:
        persistence_score = 4
    elif hints_used > 0:
        persistence_score = 3

    return error_types, creativity_score, persistence_score

@app.route('/api/ct_assessment', methods=['POST'])
def ct_assessment():
    print("API /api/ct_assessment called")
    try:
        if request.is_json:
            data = request.get_json()
            print("Received JSON assessment data:", data)
        else:
            print("Received form data")
            data = {
                'student_id': request.form.get('student_id'),
                'level': request.form.get('level'),
                'log': json.loads(request.form.get('log', '[]')),
                'robot_position': request.form.get('robot_position'),
                'apple_position': request.form.get('apple_position'),
                'unity_chatgpt_feedback_log': json.loads(request.form.get('unity_chatgpt_feedback_log', '[]')),
                'grid_rows': request.form.get('grid_rows'),
                'grid_cols': request.form.get('grid_cols'),
                'level1_starting_position_index': request.form.get('level1_starting_position_index'),
                'actions_before_run': request.form.get('actions_before_run'),
                'forward_press_intervals': json.loads(request.form.get('forward_press_intervals', '[]')),
                'attempt_number': request.form.get('attempt_number', 1),
                'time_taken': request.form.get('time_taken', 0),
                'hints_used': request.form.get('hints_used', 0),
                'block_efficiency': request.form.get('block_efficiency', 100),
                'min_blocks': request.form.get('min_blocks', 0),
                'used_blocks': request.form.get('used_blocks', 0),
                'previous_attempts': json.loads(request.form.get('previous_attempts', '[]')),
                'number_of_attempts': request.form.get('number_of_attempts', 1),
                'time_on_task': request.form.get('time_on_task', 0),
                'persistence_score': request.form.get('persistence_score'),
                'creativity_score': request.form.get('creativity_score'),
                'error_types': json.dumps(request.form.get('error_types', [])),
                'collaboration_events': json.dumps(request.form.get('collaboration_events', [])),
                'guidedActions': json.loads(request.form.get('guidedActions', '[]')),
                'correctBlankAnswer': request.form.get('correctBlankAnswer'),
                'robotStartFacing': json.loads(request.form.get('robotStartFacing', '[0,1]')),
                'blankEnabledArrows': json.loads(request.form.get('blankEnabledArrows', '[]')),
            }
            print("Parsed form assessment data:", data)
            
        student_id = data['student_id']
        level = data['level']
        action_log_data = data['log'] # This is specific to the attempt for L1, or full log for others
        robot_position_str = data['robot_position'] 
        apple_position_str = data['apple_position'] 
        unity_chatgpt_feedback_log = data.get('unity_chatgpt_feedback_log', [])
        grid_rows = data.get('grid_rows', '9') 
        grid_cols = data.get('grid_cols', '9') 

        # Level 1 Specific data
        level1_starting_position_index = data.get('level1_starting_position_index') # Will be None if not Level 1
        actions_before_run = data.get('actions_before_run')
        forward_press_intervals = data.get('forward_press_intervals')

        # Parse new advanced assessment fields
        attempt_number = data.get('attempt_number', 1)
        time_taken = data.get('time_taken', 0)
        hints_used = data.get('hints_used', 0)
        block_efficiency = data.get('block_efficiency', 100)
        min_blocks = data.get('min_blocks', 0)
        used_blocks = data.get('used_blocks', 0)
        previous_attempts = data.get('previous_attempts', [])
        number_of_attempts = data.get('number_of_attempts', 1)
        time_on_task = data.get('time_on_task', 0)
        persistence_score = data.get('persistence_score')
        creativity_score = data.get('creativity_score')
        error_types = json.dumps(data.get('error_types', []))
        collaboration_events = json.dumps(data.get('collaboration_events', []))
        guided_actions = data.get('guidedActions', [])
        correct_blank_answer = data.get('correctBlankAnswer')
        robot_start_facing = data.get('robotStartFacing', [0, 1])
        blank_enabled_arrows = data.get('blankEnabledArrows', [])

        print(f"Processing assessment for student_id={student_id}, level={level}, action log entries={len(action_log_data)}")
        if level == "Level 1":
            print(f"L1 Data: StartPosIndex: {level1_starting_position_index}, ActionsBeforeRun: {actions_before_run}, Intervals: {forward_press_intervals}")

        formatted_action_log = "\n".join([
            f"Time: {entry['timestamp']:.2f}s - Action: {entry['action']}"
            for entry in action_log_data
        ])
        
        feedback_log_text = "No in-game assistant feedback was provided for this attempt."
        if unity_chatgpt_feedback_log:
            feedback_log_text = '\n'.join([f"- {fb}" for fb in unity_chatgpt_feedback_log])

        # Add advanced assessment data to the prompt
        advanced_data_text = f"""
Additional Data for this attempt:
- Attempt number: {attempt_number}
- Time taken: {time_taken} seconds
- Number of hints used: {hints_used}
- Block efficiency: {block_efficiency} (minimum blocks: {min_blocks}, used: {used_blocks})
"""
        if previous_attempts:
            advanced_data_text += f"- Previous attempts: {len(previous_attempts)}\n"

        level_design_text = f"""
Level Design Data:
- Guided Actions: {guided_actions}
- Correct Blank Answer: {correct_blank_answer}
- Robot Start Facing: {robot_start_facing}
- Blank Enabled Arrows: {blank_enabled_arrows}
"""

        prompt = ""

        if level == "Level 1" and level1_starting_position_index is not None:
            # Convert index to 1, 2, or 3 for the prompt
            start_pos_prompt = int(level1_starting_position_index) + 1 
            optimal_paths = {
                1: "Forward x2",
                2: "Forward x3",
                3: "Forward x3"
            }
            optimal_path_desc = optimal_paths.get(start_pos_prompt, "Unknown starting position")
            intervals_str = ", ".join([f"{interval:.2f}s" for interval in forward_press_intervals]) if forward_press_intervals else "N/A"

            prompt = f"""You are an expert computational thinking (CT) assessor for Level 1 of a block-based coding game.\nThis level involves moving a robot to one of three specific apples. The optimal paths are known.\n\n{level_design_text}\n{advanced_data_text}\nLevel 1 Context:\n- Player is at Starting Position: {start_pos_prompt} (out of 3 possible start-to-apple scenarios for this level).\n- Optimal path for this starting position: {optimal_path_desc}.\n- Robot's final grid position after actions: {robot_position_str}.\n- Target apple's grid position: {apple_position_str}.\n\nStudent's Performance Data for this attempt:\n- Number of coding blocks planned BEFORE pressing 'Run': {actions_before_run}.\n- Time intervals BETWEEN each 'Forward' press (if multiple): {intervals_str}.\n- Student's Action Log (actions executed in this attempt with timestamps):\n{formatted_action_log}\n\nIn-Game Assistant Feedback Log (hints given to the student during THIS attempt):\n{feedback_log_text}\n\nIMPORTANT: If the student's actions exactly match the optimal path (even if it is just a single move), you MUST give a score of 4/4 for every dimension, and explain that this is because the student demonstrated perfect planning and execution for the task. Do NOT penalize for simplicity or lack of complexity if the solution is optimal.\n\nTask: Assess the student's CT using the 7 dimensions below for THIS ATTEMPT at Level 1. \nReturn a score from 1 (Needs Improvement) to 4 (Excellent) for each, along with a 1-2 sentence explanation for that score. \nAlso, provide an overall summary (2-3 sentences) of their performance in this attempt.\n\nRubric Dimensions for Level 1:\n1. Decomposition: Did the player plan all necessary steps before running their code? (Consider 'actions_before_run' vs optimal for {optimal_path_desc}). Score: 1-4.\n2. Timing Awareness: Were sequential 'Forward' button presses quick and fluent (under 1s is best, over 2s may indicate hesitation)? (Consider 'forward_press_intervals'). Score: 1-4.\n3. Efficiency: Did the player use the optimal number of steps to reach the apple as per {optimal_path_desc}? (Compare action log length/content to optimal). Score: 1-4.\n4. Execution Style: Was the plan structured (clear intent) or more trial-and-error for this attempt? Score: 1-4.\n5. Pattern Recognition: Did they recognize and use the repeated 'Forward' pattern required for this position's optimal path? Score: 1-4.\n6. Abstraction: Did they correctly estimate/abstract how many 'Forward' steps were needed for this specific apple? Score: 1-4.\n7. Debugging: If their actions didn't lead to the apple or were suboptimal, did they show an attempt to detect or correct mistakes (this might be more evident over multiple attempts, but assess within this attempt if possible, e.g. reacting to feedback or odd first moves)? Score: 1-4.\n8. Algorithmic Thinking: Did the player construct a clear, ordered, and logically sound set of steps to solve the problem? Score: 1-4.\n\nAlso, assess these new dimensions (score 1-4, with explanation):\n- Planning Quality\n- Execution Fidelity\n- Adaptation/Iteration\n- Creativity\n- Time to Solution\n- Block Efficiency\n- Hint Reliance\n\nAdditionally, answer these (qualitative, not scored):\n- Do you detect any misconceptions? If so, what are they?\n- What is one concrete next step or tip for the student?\n- If the student was perfect, suggest a harder challenge.\n\nProvide your assessment in a markdown table format:\n| Dimension           | Score | Explanation                                         |\n|---------------------|-------|-----------------------------------------------------|\n| Decomposition       |       |                                                     |\n| Timing Awareness    |       |                                                     |\n| Efficiency          |       |                                                     |\n| Execution Style     |       |                                                     |\n| Pattern Recognition |       |                                                     |\n| Abstraction         |       |                                                     |\n| Debugging           |       |                                                     |\n| Algorithmic Thinking|       |                                                     |\n\nOverall Summary: [Your 2-3 sentence summary here]\n"""
        else:
            # Calculate optimal path using previous apple position (or robot start for first apple)
            try:
                log_entries = action_log_data if action_log_data else []
                prev_apple_pos = None
                
                # PRIORITIZE robot_start_position from Unity payload
                if 'robot_start_position' in data and data['robot_start_position']:
                    prev_apple_pos = tuple(map(int, data['robot_start_position'].split(',')))
                    print(f"[DEBUG] Using robot_start_position from payload: {prev_apple_pos}")
                else:
                    # Fallback to previous logic
                    # Find the last 'collect' action and its position
                    for entry in reversed(log_entries):
                        if entry.get('action') == 'collect' and 'robot_position' in entry:
                            prev_apple_pos = tuple(map(int, entry['robot_position'].split(',')))
                            break
                    if prev_apple_pos is None:
                        # Use the robot's starting position from the first action in the log if available
                        if log_entries and 'robot_position' in log_entries[0]:
                            prev_apple_pos = tuple(map(int, log_entries[0]['robot_position'].split(',')))
                        else:
                            prev_apple_pos = tuple(map(int, data['robot_position'].split(',')))
                    print(f"[DEBUG] Using fallback logic for start position: {prev_apple_pos}")
                
                goal_pos = tuple(map(int, apple_position_str.split(',')))
                
                # Get obstacles for this level if available
                obstacles = []
                if 'obstacles' in data:
                    for obs in data['obstacles']:
                        pos = obs.get('position')
                        if isinstance(pos, (list, tuple)) and len(pos) == 2:
                            obstacles.append(tuple(pos))
                
                # PRIORITIZE robot_start_facing from Unity payload
                if 'robot_start_facing' in data and data['robot_start_facing']:
                    initial_facing = tuple(data['robot_start_facing'])
                    print(f"[DEBUG] Using robot_start_facing from payload: {initial_facing}")
                else:
                    # Fallback to initial_facing or default
                    initial_facing = tuple(data.get('initial_facing', (0, 1)))
                    print(f"[DEBUG] Using fallback facing: {initial_facing}")
                
                print(f"[DEBUG] Pathfinding input: prev_apple_pos={prev_apple_pos}, goal_pos={goal_pos}, initial_facing={initial_facing}, obstacles={obstacles}")
                print(f"[DEBUG] Full action log: {log_entries}")
                minimal_paths = find_optimal_path(int(grid_rows), int(grid_cols), prev_apple_pos, goal_pos, obstacles, initial_facing)
                student_path = [entry['action'].strip().lower() for entry in log_entries if 'action' in entry]
                print(f"[DEBUG] All minimal paths: {minimal_paths}")
                print(f"[DEBUG] Student action path: {student_path}")
                # Check if student path matches any minimal path (case-insensitive, ignore spacing)
                def normalize_path(path):
                    return [a.strip().lower() for a in path]
                is_optimal = False
                if minimal_paths:
                    for p in minimal_paths:
                        if normalize_path(p) == student_path:
                            is_optimal = True
                            break
                # For prompt: list all minimal paths
                minimal_paths_str = str(minimal_paths)
                prompt = f"""
You are an expert computational thinking (CT) assessor for a block-based coding game.\n\n{level_design_text}\nThe robot started at: {prev_apple_pos}, facing: {initial_facing}. The target apple is at: {goal_pos}.\nThe calculated minimal optimal paths (as lists of actions): {minimal_paths_str}\nThe student's action path (as a list of actions): {student_path}\nIMPORTANT: If the student's action path matches any minimal optimal path exactly (ignoring case and spacing), you MUST give a score of 4/4 for every dimension, and explain that this is because the student demonstrated perfect planning and execution for the task. Do NOT penalize for simplicity or lack of complexity if the solution is optimal.\nIf the paths do not match, assess as usual.\n\nStudent's Action Log (with timestamps):\n{formatted_action_log}\n\nIn-Game Assistant Feedback Log (hints given to the student during this attempt):\n{feedback_log_text}\n\nTask: Assess the student's CT skills based on their plan (coding blocks used) and execution towards reaching the apple. \nConsider the efficiency of their path, an optimal path might involve fewer steps or turns. \nAnalyze how they responded to any in-game feedback.\nProvide your assessment in a markdown table with a score from 1 (Needs Improvement) to 4 (Excellent) for each dimension, \nfollowed by a brief explanation (1-2 sentences) supporting your score for that dimension. \nFocus on the student's strategy, problem-solving process, and the application of CT skills as evidenced by their actions and timestamps.\n| Dimension           | Score | Explanation                                                                                                |\n|---------------------|-------|------------------------------------------------------------------------------------------------------------|\n| Decomposition       | 1-4   | Assess if the task was broken down. How effective was this decomposition in relation to the apple's location? |\n| Pattern Recognition | 1-4   | Did they spot/use repeating sequences? Was this appropriate for the path to the apple?                      |\n| Abstraction         | 1-4   | Did they simplify the problem (e.g. use of efficient block combinations for movement)?                     |\n| Algorithm Design    | 1-4   | How clear, correct, and efficient was their sequence of actions for reaching the apple at {apple_position_str}? Consider path directness and unnecessary moves. |\n| Debugging & Iteration | 1-4   | How did they react to mistakes or feedback? Did their subsequent actions show improvement or adaptation towards the goal? Consider timestamps for pauses or changes. |\n\nAlso, assess these new dimensions (score 1-4, with explanation):\n- Planning Quality\n- Execution Fidelity\n- Adaptation/Iteration\n- Creativity\n- Time to Solution\n- Block Efficiency\n- Hint Reliance\n\nAdditionally, answer these (qualitative, not scored):\n- Do you detect any misconceptions? If so, what are they?\n- What is one concrete next step or tip for the student?\n- If the student was perfect, suggest a harder challenge.\n\nFinally, provide an overall assessment summary (2-3 sentences) of the student's CT skills demonstrated in this attempt.\n"""
            except Exception as e:
                print(f"[ERROR] Exception in optimal path calculation: {e}")
                minimal_paths = []
                student_path = []
                prompt = f"""
You are an expert computational thinking (CT) assessor for a block-based coding game.\n\n{level_design_text}\nThere was an error calculating the optimal path. Please assess the student's actions as best as you can based on the action log and context below.\n\nStudent's Action Log (with timestamps):\n{formatted_action_log}\n\nIn-Game Assistant Feedback Log (hints given to the student during this attempt):\n{feedback_log_text}\n\nTask: Assess the student's CT skills based on their plan (coding blocks used) and execution towards reaching the apple. \nConsider the efficiency of their path, an optimal path might involve fewer steps or turns. \nAnalyze how they responded to any in-game feedback.\nProvide your assessment in a markdown table with a score from 1 (Needs Improvement) to 4 (Excellent) for each dimension, \nfollowed by a brief explanation (1-2 sentences) supporting your score for that dimension. \nFocus on the student's strategy, problem-solving process, and the application of CT skills as evidenced by their actions and timestamps.\n| Dimension           | Score | Explanation                                                                                                |\n|---------------------|-------|------------------------------------------------------------------------------------------------------------|\n| Decomposition       | 1-4   | Assess if the task was broken down. How effective was this decomposition in relation to the apple's location? |\n| Pattern Recognition | 1-4   | Did they spot/use repeating sequences? Was this appropriate for the path to the apple?                      |\n| Abstraction         | 1-4   | Did they simplify the problem (e.g. use of efficient block combinations for movement)?                     |\n| Algorithm Design    | 1-4   | How clear, correct, and efficient was their sequence of actions for reaching the apple at {apple_position_str}? Consider path directness and unnecessary moves. |\n| Debugging & Iteration | 1-4   | How did they react to mistakes or feedback? Did their subsequent actions show improvement or adaptation towards the goal? Consider timestamps for pauses or changes. |\n\nAlso, assess these new dimensions (score 1-4, with explanation):\n- Planning Quality\n- Execution Fidelity\n- Adaptation/Iteration\n- Creativity\n- Time to Solution\n- Block Efficiency\n- Hint Reliance\n\nAdditionally, answer these (qualitative, not scored):\n- Do you detect any misconceptions? If so, what are they?\n- What is one concrete next step or tip for the student?\n- If the student was perfect, suggest a harder challenge.\n\nFinally, provide an overall assessment summary (2-3 sentences) of the student's CT skills demonstrated in this attempt.\n"""

        # Ensure student_path and minimal_paths are always defined before analyze_attempt
        if 'student_path' not in locals():
            student_path = [entry['action'].strip().lower() for entry in action_log_data if 'action' in entry]
        if 'minimal_paths' not in locals():
            minimal_paths = [[]]  # No optimal path available

        error_types, creativity_score, persistence_score = analyze_attempt(
            student_path,
            minimal_paths or [[]],
            number_of_attempts=data.get('number_of_attempts', 1),
            time_on_task=data.get('time_on_task', 0),
            hints_used=data.get('hints_used', 0)
        )

        client = OpenAI(
            api_key="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"
        )
        
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}]
        )
        gpt_response = response.choices[0].message.content
        print("Received GPT response:", gpt_response[:200] + "...") # Log more for debugging

        scores, explanations, extra_scores, extra_explanations, qualitative_feedback = extract_scores_and_explanations_from_gpt_response(gpt_response)
        
        # Ensure keys used for summing total_score match those in the scores dictionary
        score_keys_for_total = ['decomposition', 'pattern_recognition', 'abstraction', 'algorithmic_thinking', 'debugging']
        current_total_score = sum(scores.get(key, 0) for key in score_keys_for_total)
        
        # Prepare extra scores/feedback for storage (to be saved in ct_extra_scores column)
        extra_scores_to_store = {
            'attempt_number': attempt_number,
            'time_taken': time_taken,
            'hints_used': hints_used,
            'block_efficiency': block_efficiency,
            'min_blocks': min_blocks,
            'used_blocks': used_blocks,
            'previous_attempts': previous_attempts,
            'advanced_scores': extra_scores,
            'advanced_explanations': extra_explanations,
            'qualitative_feedback': qualitative_feedback,
            'number_of_attempts': number_of_attempts,
            'time_on_task': time_on_task,
            'persistence_score': persistence_score,
            'creativity_score': creativity_score,
            'error_types': error_types,
            'collaboration_events': collaboration_events,
            'guided_actions': guided_actions,
            'correct_blank_answer': correct_blank_answer,
            'robot_start_facing': robot_start_facing,
            'blank_enabled_arrows': blank_enabled_arrows,
        }

        new_assessment = Assessment(
            student_id=student_id,
            level=level,
            action_log=json.dumps(action_log_data),
            gpt_response=gpt_response,
            decomposition_score=scores.get('decomposition', 0),
            pattern_recognition_score=scores.get('pattern_recognition', 0),
            abstraction_score=scores.get('abstraction', 0),
            algorithmic_thinking_score=scores.get('algorithmic_thinking', 0),
            debugging_score=scores.get('debugging', 0),
            total_score=current_total_score,
            ct_extra_scores=json.dumps(extra_scores_to_store),
            number_of_attempts=number_of_attempts,
            time_on_task=time_on_task,
            persistence_score=persistence_score,
            creativity_score=creativity_score,
            error_types=json.dumps(error_types),
            collaboration_events=collaboration_events
        )
        db.session.add(new_assessment)
        db.session.commit()
        print(f"Assessment saved to database with ID: {new_assessment.id}, Total Score: {current_total_score}, Scores: {scores}")

        return jsonify({'assessment': gpt_response, 'scores': scores, 'explanations': explanations, 'advanced_scores': extra_scores, 'advanced_explanations': extra_explanations, 'qualitative_feedback': qualitative_feedback})
        
    except Exception as e:
        error_msg = str(e)
        print(f"Error in ct_assessment: {error_msg}")
        import traceback
        print(traceback.format_exc())
        return jsonify({
            'status': 'error',
            'message': error_msg
        }), 500

def extract_scores_and_explanations_from_gpt_response(response_text):
    scores = {
        'decomposition': 0,
        'pattern_recognition': 0,
        'abstraction': 0,
        'algorithmic_thinking': 0,  # Key used in GPT prompt and for parsing
        'debugging': 0
    }
    explanations = {
        'decomposition': '',
        'pattern_recognition': '',
        'abstraction': '',
        'algorithmic_thinking': '',
        'debugging': ''
    }
    # New advanced dimensions
    extra_scores = {
        'planning_quality': 0,
        'execution_fidelity': 0,
        'adaptation_iteration': 0,
        'creativity': 0,
        'time_to_solution': 0,
        'block_efficiency': 0,
        'hint_reliance': 0
    }
    extra_explanations = {
        'planning_quality': '',
        'execution_fidelity': '',
        'adaptation_iteration': '',
        'creativity': '',
        'time_to_solution': '',
        'block_efficiency': '',
        'hint_reliance': ''
    }
    # Qualitative feedback
    qualitative_feedback = {
        'misconceptions': '',
        'next_step': '',
        'harder_challenge': '',
        'overall_summary': ''
    }
    try:
        lines = response_text.split('\n')
        dimension_map = {
            "Decomposition": "decomposition",
            "Pattern Recognition": "pattern_recognition",
            "Abstraction": "abstraction",
            "Algorithm Design": "algorithmic_thinking",
            "Algorithmic Thinking": "algorithmic_thinking",
            "Debugging & Iteration": "debugging",
            "Debugging": "debugging",
            # Advanced
            "Planning Quality": "planning_quality",
            "Execution Fidelity": "execution_fidelity",
            "Adaptation/Iteration": "adaptation_iteration",
            "Creativity": "creativity",
            "Time to Solution": "time_to_solution",
            "Block Efficiency": "block_efficiency",
            "Hint Reliance": "hint_reliance"
        }
        # Parse markdown tables for scores and explanations
        for line in lines:
            if not line.strip().startswith('|'):
                continue
            parts = [part.strip() for part in line.split('|') if part.strip()]
            if len(parts) >= 2:
                dimension_from_gpt = parts[0]
                score_str = parts[1]
                normalized_dimension_key = None
                for map_key, dict_key in dimension_map.items():
                    if map_key.lower() in dimension_from_gpt.lower():
                        normalized_dimension_key = dict_key
                        break
                if normalized_dimension_key and score_str.isdigit():
                    score_val = int(score_str)
                    if normalized_dimension_key in scores:
                        scores[normalized_dimension_key] = score_val
                        if len(parts) >= 3:
                            explanations[normalized_dimension_key] = parts[2]
                    elif normalized_dimension_key in extra_scores:
                        extra_scores[normalized_dimension_key] = score_val
                        if len(parts) >= 3:
                            extra_explanations[normalized_dimension_key] = parts[2]
        # Parse qualitative feedback (look for lines starting with the question or label)
        for i, line in enumerate(lines):
            l = line.lower()
            if 'misconception' in l:
                qualitative_feedback['misconceptions'] = lines[i+1].strip() if i+1 < len(lines) else ''
            elif 'next step' in l or 'tip' in l:
                qualitative_feedback['next_step'] = lines[i+1].strip() if i+1 < len(lines) else ''
            elif 'harder challenge' in l:
                qualitative_feedback['harder_challenge'] = lines[i+1].strip() if i+1 < len(lines) else ''
            elif 'overall summary' in l:
                # Try to get the next non-empty line(s) as summary
                summary_lines = []
                for j in range(i+1, min(i+4, len(lines))):
                    if lines[j].strip():
                        summary_lines.append(lines[j].strip())
                qualitative_feedback['overall_summary'] = ' '.join(summary_lines)
        print(f"Extracted Scores: {scores}")
        print(f"Extracted Explanations: {explanations}")
        print(f"Extracted Extra Scores: {extra_scores}")
        print(f"Extracted Extra Explanations: {extra_explanations}")
        print(f"Extracted Qualitative Feedback: {qualitative_feedback}")
    except Exception as e:
        print(f"Error during score/explanation extraction (Expanded): {str(e)}")
    return scores, explanations, extra_scores, extra_explanations, qualitative_feedback

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

def find_optimal_path(grid_rows, grid_cols, start, goal, obstacles=None, initial_facing=(0, 1)):
    # Returns a list of all minimal-length paths (each path is a list of actions)
    obstacle_set = set(obstacles) if obstacles else set()
    queue = deque()
    # Each state: (x, y), facing, path
    queue.append((start, initial_facing, []))
    visited = dict()  # (x, y, facing) -> path length
    visited[(start, initial_facing)] = 0
    # Directions: (dx, dy), move name
    directions = [((0,1), 'Forward'), ((0,-1), 'Backward'), ((1,0), 'Right'), ((-1,0), 'Left')]
    # Facing order: up, right, down, left
    facing_order = [ (0,1), (1,0), (0,-1), (-1,0) ]
    minimal_paths = []
    minimal_length = None
    while queue:
        (x, y), facing, path = queue.popleft()
        if (x, y) == goal:
            if minimal_length is None:
                minimal_length = len(path)
            if len(path) == minimal_length:
                minimal_paths.append(path)
            continue
        if minimal_length is not None and len(path) > minimal_length:
            continue  # Only collect minimal paths
        # Try moving forward (if facing that way)
        nx, ny = x + facing[0], y + facing[1]
        state_fwd = ((nx, ny), facing)
        if (
            (nx, ny) not in obstacle_set and
            (state_fwd not in visited or visited[state_fwd] > len(path) + 1)
        ):
            queue.append( ((nx, ny), facing, path + ['Forward']) )
            visited[state_fwd] = len(path) + 1
        # Try moving backward (if facing that way)
        back_facing = (-facing[0], -facing[1])
        bx, by = x + back_facing[0], y + back_facing[1]
        state_bwd = ((bx, by), facing)
        if (
            (bx, by) not in obstacle_set and
            (state_bwd not in visited or visited[state_bwd] > len(path) + 1)
        ):
            queue.append( ((bx, by), facing, path + ['Backward']) )
            visited[state_bwd] = len(path) + 1
        # Try turning left
        current_facing_idx = facing_order.index(facing)
        new_facing_left = facing_order[(current_facing_idx - 1) % 4]
        state_left = ((x, y), new_facing_left)
        if (state_left not in visited or visited[state_left] > len(path) + 1):
            queue.append( ((x, y), new_facing_left, path + ['Turn Left']) )
            visited[state_left] = len(path) + 1
        # Try turning right
        new_facing_right = facing_order[(current_facing_idx + 1) % 4]
        state_right = ((x, y), new_facing_right)
        if (state_right not in visited or visited[state_right] > len(path) + 1):
            queue.append( ((x, y), new_facing_right, path + ['Turn Right']) )
            visited[state_right] = len(path) + 1
    return minimal_paths if minimal_paths else None

@app.template_filter('loads')
def json_loads_filter(s):
    try:
        return json.loads(s)
    except Exception:
        return []

@app.route('/game-test')
def game_test():
    return render_template('game_test.html')

@app.route('/game')
def serve_game():
    return send_from_directory('webgl/coding-game', 'index.html')

@app.route('/game/debug')
def debug_game_files():
    """Debug route to check if Unity WebGL files exist"""
    import os
    files = []
    game_dir = 'webgl/coding-game'
    
    if os.path.exists(game_dir):
        for root, dirs, filenames in os.walk(game_dir):
            for filename in filenames:
                filepath = os.path.join(root, filename)
                files.append({
                    'name': filename,
                    'path': filepath,
                    'size': os.path.getsize(filepath) if os.path.exists(filepath) else 0,
                    'exists': os.path.exists(filepath)
                })
    
    return jsonify({
        'game_dir_exists': os.path.exists(game_dir),
        'files': files
    })

@app.route('/game/<path:filename>')
def serve_game_files(filename):
    file_path = os.path.join('webgl/coding-game', filename)
    
    # Handle compressed Unity WebGL files
    if filename.endswith('.gz'):
        try:
            with open(file_path, 'rb') as f:
                content = f.read()
            response = Response(content)
            
            # Set correct MIME types for Unity WebGL files
            if filename.endswith('.wasm.gz'):
                response.headers['Content-Type'] = 'application/wasm'
            elif filename.endswith('.js.gz'):
                response.headers['Content-Type'] = 'application/javascript'
            elif filename.endswith('.data.gz'):
                response.headers['Content-Type'] = 'application/octet-stream'
            
            response.headers['Content-Encoding'] = 'gzip'
            return response
        except FileNotFoundError:
            return "File not found", 404
    
    # Handle regular files
    try:
        response = send_from_directory('webgl/coding-game', filename)
        
        # Set correct MIME types for Unity WebGL files
        if filename.endswith('.wasm'):
            response.headers['Content-Type'] = 'application/wasm'
        elif filename.endswith('.js'):
            response.headers['Content-Type'] = 'application/javascript'
        elif filename.endswith('.data'):
            response.headers['Content-Type'] = 'application/octet-stream'
        elif filename.endswith('.css'):
            response.headers['Content-Type'] = 'text/css'
        elif filename.endswith('.png'):
            response.headers['Content-Type'] = 'image/png'
        elif filename.endswith('.jpg') or filename.endswith('.jpeg'):
            response.headers['Content-Type'] = 'image/jpeg'
        
        return response
    except FileNotFoundError:
        return "File not found", 404

@app.route('/Build/<path:filename>')
def serve_build_data(filename):
    return send_from_directory('webgl/coding-game/Build', filename)

@app.route('/TemplateData/<path:filename>')
def serve_template_data(filename):
    return send_from_directory('webgl/coding-game/TemplateData', filename)

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    
    # Use environment variable for port in production
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False) 