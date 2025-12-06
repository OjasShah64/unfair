"""
UNFAIR Backend Server
Track and verify AI-assisted coding process
"""

import os
import json
import uuid
from datetime import datetime, timedelta
from functools import wraps
from typing import Dict, List, Tuple

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
import jwt

# ===== INITIALIZATION =====
app = Flask(__name__)
CORS(app)

# Configuration
# Ensure database is created in the server directory
db_path = os.path.join(os.path.dirname(__file__), 'unfair.db')
db_uri = os.getenv('DATABASE_URL', f'sqlite:///{db_path}')
app.config['SQLALCHEMY_DATABASE_URI'] = db_uri
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
app.config['JWT_EXPIRATION_HOURS'] = 24

db = SQLAlchemy(app)

# ===== DATABASE MODELS =====


class User(db.Model):
    """User model for students and professors"""

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255))
    name = db.Column(db.String(120))
    role = db.Column(db.String(20), default='student')  # student or professor
    institution = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    assignments = db.relationship('Assignment', backref='student', lazy=True, foreign_keys='Assignment.student_id')
    courses = db.relationship('Course', backref='professor', lazy=True, foreign_keys='Course.professor_id')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'name': self.name,
            'role': self.role,
            'institution': self.institution,
        }


class Course(db.Model):
    """Course model"""

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    professor_id = db.Column(db.String(36), db.ForeignKey('user.id'), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    code = db.Column(db.String(20))
    description = db.Column(db.Text)
    ai_allowed = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    assignments = db.relationship('Assignment', backref='course', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'code': self.code,
            'description': self.description,
            'ai_allowed': self.ai_allowed,
        }


class Assignment(db.Model):
    """Assignment model"""

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    student_id = db.Column(db.String(36), db.ForeignKey('user.id'), nullable=False)
    course_id = db.Column(db.String(36), db.ForeignKey('course.id'), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    due_date = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    submitted_at = db.Column(db.DateTime)
    status = db.Column(db.String(20), default='in_progress')  # in_progress, paused, submitted
    recording_time = db.Column(db.Integer, default=0)  # in seconds

    interactions = db.relationship('Interaction', backref='assignment', lazy=True, cascade='all, delete-orphan')
    transcripts = db.relationship('Transcript', backref='assignment', lazy=True, cascade='all, delete-orphan')

    def to_dict(self, include_interactions=False):
        data = {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'due_date': self.due_date.isoformat() if self.due_date else None,
            'status': self.status,
            'recording_time': self.recording_time,
            'interaction_count': len(self.interactions),
            'created_at': self.created_at.isoformat(),
        }

        if include_interactions:
            data['interactions'] = [i.to_dict() for i in self.interactions]

        return data


class Interaction(db.Model):
    """AI interaction/conversation model"""

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    assignment_id = db.Column(db.String(36), db.ForeignKey('assignment.id'), nullable=False)
    interaction_type = db.Column(db.String(20))  # prompt, response
    category = db.Column(db.String(50))  # Brainstorming, Debugging, Syntax Help, etc.
    content = db.Column(db.Text, nullable=False)
    full_content = db.Column(db.Text)
    platform = db.Column(db.String(50))  # ChatGPT, Claude, etc.
    code_blocks = db.Column(db.JSON, default=[])
    timestamp = db.Column(db.String(50))
    captured_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'type': self.interaction_type,
            'category': self.category,
            'content': self.content,
            'platform': self.platform,
            'timestamp': self.timestamp,
            'captured_at': self.captured_at.isoformat(),
        }


class Transcript(db.Model):
    """Generated transcript/verification record"""

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    assignment_id = db.Column(db.String(36), db.ForeignKey('assignment.id'), nullable=False)
    generated_at = db.Column(db.DateTime, default=datetime.utcnow)
    share_token = db.Column(db.String(36), unique=True, default=lambda: str(uuid.uuid4()))
    share_expires_at = db.Column(db.DateTime, default=lambda: datetime.utcnow() + timedelta(days=365))

    summary_stats = db.Column(db.JSON)  # total_interactions, active_time, content_used, ai_assistance

    def to_dict(self, include_details=False):
        data = {
            'id': self.id,
            'generated_at': self.generated_at.isoformat(),
            'share_token': self.share_token,
            'summary_stats': self.summary_stats,
        }
        return data


# ===== AUTHENTICATION HELPERS =====


def create_token(user_id: str) -> str:
    """Create JWT token"""
    payload = {
        'user_id': user_id,
        'exp': datetime.utcnow() + timedelta(hours=app.config['JWT_EXPIRATION_HOURS']),
    }
    return jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')


def verify_token(token: str) -> Dict:
    """Verify JWT token"""
    try:
        payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def token_required(f):
    """Decorator for routes requiring authentication"""

    @wraps(f)
    def decorated(*args, **kwargs):
        token = None

        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                # Support both "Bearer <token>" and just "<token>"
                parts = auth_header.split(' ')
                token = parts[1] if len(parts) > 1 else parts[0]
            except (IndexError, AttributeError):
                return jsonify({
                    'error': 'Invalid token format',
                    'message': 'Expected: Authorization: Bearer <token>'
                }), 401

        if not token:
            return jsonify({
                'error': 'Missing authentication token',
                'message': 'Add Authorization header: Bearer <token>'
            }), 401

        payload = verify_token(token)
        if not payload:
            return jsonify({
                'error': 'Invalid or expired token',
                'message': 'Token verification failed'
            }), 401

        return f(payload['user_id'], *args, **kwargs)

    return decorated


# ===== API ROUTES =====


@app.route('/', methods=['GET'])
def root():
    """Root endpoint - API information"""
    return jsonify({
        'name': 'UNFAIR Backend API',
        'version': '1.0.0',
        'status': 'running',
        'endpoints': {
            'health': '/api/health',
            'assignments': '/api/assignments',
            'interactions': '/api/assignments/<id>/interactions',
            'transcripts': '/api/assignments/<id>/transcript'
        },
        'documentation': 'All endpoints except /api/health require authentication'
    }), 200


# ===== Assignment Routes =====


@app.route('/api/assignments', methods=['GET'])
@token_required
def get_assignments(user_id):
    """Get all assignments for current user"""
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    assignments = Assignment.query.filter_by(student_id=user_id).all()
    return jsonify([a.to_dict() for a in assignments]), 200


@app.route('/api/assignments', methods=['POST'])
@token_required
def create_assignment(user_id):
    """Create new assignment"""
    data = request.json

    try:
        assignment = Assignment(
            student_id=user_id,
            course_id=data.get('course_id'),
            name=data.get('name'),
            description=data.get('description'),
            due_date=datetime.fromisoformat(data.get('due_date')) if data.get('due_date') else None,
        )
        db.session.add(assignment)
        db.session.commit()

        return jsonify(assignment.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400


@app.route('/api/assignments/<assignment_id>', methods=['GET'])
@token_required
def get_assignment(user_id, assignment_id):
    """Get specific assignment with interactions"""
    assignment = Assignment.query.get(assignment_id)

    if not assignment or assignment.student_id != user_id:
        return jsonify({'error': 'Assignment not found'}), 404

    return jsonify(assignment.to_dict(include_interactions=True)), 200


@app.route('/api/assignments/<assignment_id>', methods=['PUT'])
@token_required
def update_assignment(user_id, assignment_id):
    """Update assignment"""
    assignment = Assignment.query.get(assignment_id)

    if not assignment or assignment.student_id != user_id:
        return jsonify({'error': 'Assignment not found'}), 404

    data = request.json
    assignment.status = data.get('status', assignment.status)
    assignment.recording_time = data.get('recording_time', assignment.recording_time)

    db.session.commit()
    return jsonify(assignment.to_dict()), 200


# ===== Interaction Routes =====


@app.route('/api/assignments/<assignment_id>/interactions', methods=['POST'])
@token_required
def log_interaction(user_id, assignment_id):
    """Log new AI interaction"""
    assignment = Assignment.query.get(assignment_id)

    if not assignment or assignment.student_id != user_id:
        return jsonify({'error': 'Assignment not found'}), 404

    data = request.json

    try:
        interaction = Interaction(
            assignment_id=assignment_id,
            interaction_type=data.get('type'),
            category=data.get('category'),
            content=data.get('content'),
            full_content=data.get('fullContent'),
            platform=data.get('platform'),
            code_blocks=data.get('codeBlocks', []),
            timestamp=data.get('timestamp'),
        )
        db.session.add(interaction)
        db.session.commit()

        return jsonify(interaction.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400


@app.route('/api/assignments/<assignment_id>/interactions', methods=['GET'])
@token_required
def get_interactions(user_id, assignment_id):
    """Get all interactions for assignment"""
    assignment = Assignment.query.get(assignment_id)

    if not assignment or assignment.student_id != user_id:
        return jsonify({'error': 'Assignment not found'}), 404

    interactions = Interaction.query.filter_by(assignment_id=assignment_id).all()
    return jsonify([i.to_dict() for i in interactions]), 200


# ===== Transcript Routes =====


@app.route('/api/assignments/<assignment_id>/transcript', methods=['POST'])
@token_required
def generate_transcript(user_id, assignment_id):
    """Generate verified transcript"""
    assignment = Assignment.query.get(assignment_id)

    if not assignment or assignment.student_id != user_id:
        return jsonify({'error': 'Assignment not found'}), 404

    # Calculate statistics
    interactions = Interaction.query.filter_by(assignment_id=assignment_id).all()
    prompts = [i for i in interactions if i.interaction_type == 'prompt']
    responses = [i for i in interactions if i.interaction_type == 'response']

    # Estimate AI contribution (simplified)
    ai_contribution = min(len(responses) * 5, 100)  # Mock calculation

    summary = {
        'total_interactions': len(interactions),
        'user_prompts': len(prompts),
        'ai_responses': len(responses),
        'active_time_seconds': assignment.recording_time,
        'ai_assistance_percentage': ai_contribution,
        'generated_at': datetime.utcnow().isoformat(),
    }

    try:
        transcript = Transcript(assignment_id=assignment_id, summary_stats=summary)
        db.session.add(transcript)
        db.session.commit()

        assignment.submitted_at = datetime.utcnow()
        assignment.status = 'submitted'
        db.session.commit()

        return jsonify(transcript.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400


@app.route('/api/transcripts/<transcript_id>', methods=['GET'])
def get_transcript(transcript_id):
    """Get transcript by ID (public endpoint)"""
    transcript = Transcript.query.get(transcript_id)

    if not transcript:
        return jsonify({'error': 'Transcript not found'}), 404

    # Check if share token is still valid
    if transcript.share_expires_at and transcript.share_expires_at < datetime.utcnow():
        return jsonify({'error': 'Transcript share link has expired'}), 403

    assignment = transcript.assignment
    interactions = Interaction.query.filter_by(assignment_id=assignment.id).all()

    return jsonify({
        'transcript': transcript.to_dict(),
        'assignment': {
            'name': assignment.name,
            'due_date': assignment.due_date.isoformat() if assignment.due_date else None,
        },
        'interactions': [i.to_dict() for i in interactions],
    }), 200


@app.route('/api/transcripts/<transcript_id>/share', methods=['POST'])
@token_required
def update_transcript_share(user_id, transcript_id):
    """Update transcript share settings"""
    transcript = Transcript.query.get(transcript_id)

    if not transcript or transcript.assignment.student_id != user_id:
        return jsonify({'error': 'Transcript not found'}), 404

    data = request.json

    if data.get('enable_sharing'):
        transcript.share_expires_at = datetime.utcnow() + timedelta(days=data.get('share_days', 365))
    else:
        transcript.share_expires_at = datetime.utcnow()

    db.session.commit()

    return jsonify({
        'share_token': transcript.share_token,
        'expires_at': transcript.share_expires_at.isoformat(),
    }), 200


# ===== Health Check =====


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    try:
        # Test database connection
        db.session.execute(db.text('SELECT 1'))
        db_status = 'connected'
    except Exception as e:
        db_status = f'error: {str(e)}'
    
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'database': db_status,
        'version': '1.0.0',
        'endpoints': {
            'root': '/',
            'health': '/api/health',
            'assignments': '/api/assignments (requires auth)',
            'interactions': '/api/assignments/<id>/interactions (requires auth)',
            'transcripts': '/api/assignments/<id>/transcript (requires auth)'
        }
    }), 200


# ===== Error Handlers =====


@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404


@app.errorhandler(500)
def internal_error(error):
    db.session.rollback()
    return jsonify({'error': 'Internal server error'}), 500


# ===== DATABASE INITIALIZATION =====


def init_db():
    """Initialize database"""
    with app.app_context():
        try:
            db.create_all()
            print('Database initialized')
            print(f'Database location: {app.config["SQLALCHEMY_DATABASE_URI"]}')
        except Exception as e:
            print(f'Error initializing database: {e}')
            raise


# ===== MAIN =====


if __name__ == '__main__':
    print('=' * 60)
    print('UNFAIR Backend Server')
    print('=' * 60)
    print(f'Starting server on http://0.0.0.0:5000')
    print(f'Health check: http://localhost:5000/api/health')
    print('=' * 60)
    
    try:
        init_db()
        debug_mode = os.getenv('FLASK_ENV') == 'development'
        print(f'Debug mode: {debug_mode}')
        print('Server ready!')
        print('=' * 60)
        app.run(host='0.0.0.0', port=5000, debug=debug_mode)
    except Exception as e:
        print(f'Failed to start server: {e}')
        import traceback
        traceback.print_exc()
