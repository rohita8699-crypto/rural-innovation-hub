pipeline {
  agent any

  environment {
    APP_NAME = 'rural-innovation-hub'
    IMAGE_NAME = 'rural-innovation-hub:latest'
    TEST_PORT = '3100'
  }

  stages {
    stage('Checkout from Git') {
      steps {
        checkout scm
      }
    }

    stage('Install Dependencies') {
      steps {
        bat 'npm install'
      }
    }

    stage('Code and Project Checks') {
      steps {
        bat 'npm run lint'
        bat 'npm test'
      }
    }

    stage('Docker Build') {
      steps {
        bat 'docker build -t %IMAGE_NAME% .'
      }
    }

    stage('Docker Smoke Test') {
      steps {
        bat 'docker rm -f %APP_NAME%-test || exit /b 0'
        bat 'docker run -d --name %APP_NAME%-test -p %TEST_PORT%:3000 %IMAGE_NAME%'
        bat '''powershell -Command "Start-Sleep -Seconds 5; $response = Invoke-RestMethod http://localhost:%TEST_PORT%/api/health; if ($response.status -ne 'ok') { exit 1 }"'''
      }
      post {
        always {
          bat 'docker rm -f %APP_NAME%-test || exit /b 0'
        }
      }
    }
  }

  post {
    success {
      echo 'Build passed. The Rural Innovation Hub image is ready to run.'
    }
    failure {
      echo 'Build failed. Check the Jenkins stage logs for the exact problem.'
    }
  }
}
