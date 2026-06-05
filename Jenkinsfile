pipeline {
    agent any

    environment {
        VM_HOST = '192.168.1.117'
        FRONTEND_URL = 'http://192.168.1.117:3000'
        BACKEND_URL = 'http://192.168.1.117:3001/api'

        POSTGRES_DB = 'plannings'
        POSTGRES_USER = 'postgres'
        POSTGRES_HOST_PORT = '5433'
        SERVER_PORT = '3001'
        VITE_API_BASE_URL = '/api'
        SPRING_MAIL_HOST = 'smtp.gmail.com'
        SPRING_MAIL_PORT = '587'
        SPRING_MAIL_SMTP_AUTH = 'true'
        SPRING_MAIL_STARTTLS_ENABLE = 'true'
        SPRING_MAIL_STARTTLS_REQUIRED = 'true'
        APP_ACCOUNT_MAIL_ENABLED = 'true'
        APP_ALERT_MAIL_ENABLED = 'true'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Verify Docker') {
            steps {
                sh '''
                    docker --version
                    docker compose version
                '''
            }
        }

        stage('Create Environment File') {
            steps {
                withCredentials([
                    string(credentialsId: 'gestion-planning-postgres-password', variable: 'POSTGRES_PASSWORD'),
                    string(credentialsId: 'gestion-planning-cloudinary-name', variable: 'CLOUDINARY_CLOUD_NAME'),
                    string(credentialsId: 'gestion-planning-cloudinary-key', variable: 'CLOUDINARY_API_KEY'),
                    string(credentialsId: 'gestion-planning-cloudinary-secret', variable: 'CLOUDINARY_API_SECRET'),
                    string(credentialsId: 'gestion-planning-mail-username', variable: 'SPRING_MAIL_USERNAME'),
                    string(credentialsId: 'gestion-planning-mail-password', variable: 'SPRING_MAIL_PASSWORD')
                ]) {
                    sh '''
                        cat > .env <<EOF
POSTGRES_DB=${POSTGRES_DB}
POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_HOST_PORT=${POSTGRES_HOST_PORT}

SERVER_PORT=${SERVER_PORT}
APP_FRONTEND_URL=${FRONTEND_URL}
VITE_API_BASE_URL=${VITE_API_BASE_URL}

CLOUDINARY_CLOUD_NAME=${CLOUDINARY_CLOUD_NAME}
CLOUDINARY_API_KEY=${CLOUDINARY_API_KEY}
CLOUDINARY_API_SECRET=${CLOUDINARY_API_SECRET}

SPRING_MAIL_USERNAME=${SPRING_MAIL_USERNAME}
SPRING_MAIL_PASSWORD=${SPRING_MAIL_PASSWORD}
SPRING_MAIL_HOST=${SPRING_MAIL_HOST}
SPRING_MAIL_PORT=${SPRING_MAIL_PORT}
SPRING_MAIL_SMTP_AUTH=${SPRING_MAIL_SMTP_AUTH}
SPRING_MAIL_STARTTLS_ENABLE=${SPRING_MAIL_STARTTLS_ENABLE}
SPRING_MAIL_STARTTLS_REQUIRED=${SPRING_MAIL_STARTTLS_REQUIRED}
APP_ACCOUNT_MAIL_ENABLED=${APP_ACCOUNT_MAIL_ENABLED}
APP_ALERT_MAIL_ENABLED=${APP_ALERT_MAIL_ENABLED}
EOF
                    '''
                }
            }
        }

        stage('Build Images') {
            steps {
                sh '''
                    docker compose build --pull
                '''
            }
        }

        stage('Deploy') {
            steps {
                sh '''
                    docker compose up -d --remove-orphans
                '''
            }
        }

        stage('Health Check') {
            steps {
                sh '''
                    docker compose ps

                    echo "Waiting for backend..."
                    for i in $(seq 1 30); do
                        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" ${BACKEND_URL}/auth/me || true)
                        if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
                            echo "Backend is reachable"
                            exit 0
                        fi

                        sleep 2
                    done

                    echo "Backend health check did not return success. Showing logs:"
                    docker compose logs --tail=120 backend
                    exit 1
                '''
            }
        }
    }

    post {
        success {
            echo "Deployment completed: ${FRONTEND_URL}"
        }

        failure {
            sh '''
                docker compose ps || true
                docker compose logs --tail=120 || true
            '''
        }

        always {
            sh '''
                docker image prune -f || true
            '''
        }
    }
}
