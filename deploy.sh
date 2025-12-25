#!/bin/bash

# TSP NineteenPay Backend Deployment Script
# This script pushes code to GitHub and then deploys to the backend server

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SERVER_IP="64.227.171.110"
SERVER_USER="root"
SERVER_SSH_KEY="$HOME/.ssh/backend_server"
SERVER_APP_DIR="/opt/tsp_nineteenpay_backend"
GITHUB_REPO="git@github.com:unsungkdk/nineteentsp.git"

# Function to print colored messages
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Setup SSH agent to avoid multiple passphrase prompts
print_info "Setting up SSH agent..."
if [ -z "$SSH_AUTH_SOCK" ]; then
    eval "$(ssh-agent -s)" > /dev/null 2>&1
    export SSH_AUTH_SOCK
    export SSH_AGENT_PID
fi

# Add SSH key to agent (will prompt for passphrase once)
print_info "Adding SSH key to agent (enter passphrase when prompted)..."
if ! ssh-add "$SERVER_SSH_KEY" 2>/dev/null; then
    print_warn "Could not add key to agent. You may be prompted for passphrase multiple times."
fi

# Cleanup function to kill ssh-agent on exit (only if we started it)
ORIGINAL_SSH_AUTH_SOCK="$SSH_AUTH_SOCK"
cleanup() {
    if [ -n "$SSH_AGENT_PID" ] && [ -z "$ORIGINAL_SSH_AUTH_SOCK" ]; then
        ssh-agent -k > /dev/null 2>&1 || true
    fi
}
trap cleanup EXIT

# Step 1: Push to GitHub
print_info "Step 1: Pushing code to GitHub..."

# Check if we're in a git repository
if [ ! -d .git ]; then
    print_error "Not a git repository. Initializing..."
    git init
    git remote add origin "$GITHUB_REPO" 2>/dev/null || git remote set-url origin "$GITHUB_REPO"
fi

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    print_warn "You have uncommitted changes. Please commit them first or stash them."
    read -p "Do you want to commit all changes? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git add .
        read -p "Enter commit message: " commit_msg
        git commit -m "${commit_msg:-Deploy: $(date +%Y-%m-%d\ %H:%M:%S)}"
    else
        print_error "Aborting deployment. Please commit or stash your changes."
        exit 1
    fi
fi

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)
if [ -z "$CURRENT_BRANCH" ]; then
    CURRENT_BRANCH="main"
    git branch -M main 2>/dev/null || true
fi

# Push to GitHub
print_info "Pushing to GitHub (branch: $CURRENT_BRANCH)..."
git push -u origin "$CURRENT_BRANCH" || {
    print_error "Failed to push to GitHub. Please check your GitHub SSH setup."
    exit 1
}

print_info "✓ Code pushed to GitHub successfully"

# Step 2: Deploy to server
print_info "Step 2: Deploying to backend server ($SERVER_IP)..."

# SSH command with key
SSH_CMD="ssh -i $SERVER_SSH_KEY -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_IP"

# Check server connection
print_info "Checking server connection..."
if ! $SSH_CMD "echo 'Connection successful'" >/dev/null 2>&1; then
    print_error "Cannot connect to server. Please check SSH setup."
    exit 1
fi

print_info "✓ Server connection successful"

# Step 3: Check and install server dependencies
print_info "Step 3: Checking server dependencies..."

# Function to check and install Node.js
check_nodejs() {
    print_info "Checking Node.js installation..."
    NODE_VERSION=$($SSH_CMD "node --version 2>/dev/null | cut -d'v' -f2" || echo "0")
    
    if [ -z "$NODE_VERSION" ] || [ "$NODE_VERSION" = "0" ]; then
        print_warn "Node.js not found. Installing Node.js 20.x..."
        $SSH_CMD "curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs" || {
            print_error "Failed to install Node.js"
            exit 1
        }
        print_info "✓ Node.js installed"
    else
        # Check if version is >= 20
        MAJOR_VERSION=$(echo "$NODE_VERSION" | cut -d'.' -f1)
        if [ "$MAJOR_VERSION" -lt 20 ]; then
            print_warn "Node.js version $NODE_VERSION is less than 20. Upgrading..."
            $SSH_CMD "curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs"
            print_info "✓ Node.js upgraded"
        else
            print_info "✓ Node.js $NODE_VERSION is installed"
        fi
    fi
}

# Function to check and install npm
check_npm() {
    print_info "Checking npm installation..."
    NPM_VERSION=$($SSH_CMD "npm --version 2>/dev/null" || echo "0")
    
    if [ -z "$NPM_VERSION" ] || [ "$NPM_VERSION" = "0" ]; then
        print_warn "npm not found. Installing..."
        $SSH_CMD "apt-get update && apt-get install -y npm"
        print_info "✓ npm installed"
    else
        # Check if version is >= 10
        MAJOR_VERSION=$(echo "$NPM_VERSION" | cut -d'.' -f1)
        if [ "$MAJOR_VERSION" -lt 10 ]; then
            print_warn "npm version $NPM_VERSION is less than 10. Upgrading..."
            $SSH_CMD "npm install -g npm@latest"
            print_info "✓ npm upgraded"
        else
            print_info "✓ npm $NPM_VERSION is installed"
        fi
    fi
}

# Function to check and install Git
check_git() {
    print_info "Checking Git installation..."
    if ! $SSH_CMD "command -v git >/dev/null 2>&1"; then
        print_warn "Git not found. Installing..."
        $SSH_CMD "apt-get update && apt-get install -y git"
        print_info "✓ Git installed"
    else
        print_info "✓ Git is installed"
    fi
}

# Function to check and install build essentials
check_build_tools() {
    print_info "Checking build tools..."
    if ! $SSH_CMD "command -v make >/dev/null 2>&1"; then
        print_warn "Build tools not found. Installing..."
        $SSH_CMD "apt-get update && apt-get install -y build-essential"
        print_info "✓ Build tools installed"
    else
        print_info "✓ Build tools are installed"
    fi
}

# Run dependency checks
check_git
check_nodejs
check_npm
check_build_tools

# Step 4: Setup GitHub SSH on server (if needed)
print_info "Step 4: Checking GitHub SSH setup on server..."

# Add GitHub to known_hosts to avoid host key verification failure
print_info "Adding GitHub to known_hosts..."
$SSH_CMD "mkdir -p ~/.ssh && ssh-keyscan -t rsa,ed25519 github.com >> ~/.ssh/known_hosts 2>/dev/null || true"

# Check if github_deploy key exists
if $SSH_CMD "[ -f ~/.ssh/github_deploy ]"; then
    print_info "Found existing GitHub SSH key."
    
    # Ensure SSH config is set up to use this key
    if ! $SSH_CMD "grep -q 'Host github.com' ~/.ssh/config 2>/dev/null"; then
        print_info "Configuring SSH to use existing key..."
        $SSH_CMD "cat >> ~/.ssh/config << 'EOF'
Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/github_deploy
    IdentitiesOnly yes
    StrictHostKeyChecking=no
EOF
chmod 600 ~/.ssh/config"
    fi
    
    # Test GitHub SSH connection
    print_info "Testing GitHub SSH connection..."
    GITHUB_TEST=$($SSH_CMD "ssh -T git@github.com 2>&1" || true)
    
    # GitHub returns various success messages, check for any positive response
    # GitHub success messages include: "Hi username! You've successfully authenticated..."
    if echo "$GITHUB_TEST" | grep -qiE "successfully authenticated|you've successfully authenticated|hi.*you've successfully"; then
        print_info "✓ GitHub SSH is working correctly"
    else
        print_warn "GitHub SSH test failed. Output: $GITHUB_TEST"
        print_warn "Key may not be added to GitHub account."
        SERVER_PUB_KEY=$($SSH_CMD "cat ~/.ssh/github_deploy.pub")
        print_warn "Please verify this key is added to your GitHub account:"
        echo ""
        echo "$SERVER_PUB_KEY"
        echo ""
        print_warn "Go to: https://github.com/settings/keys"
        read -p "Press Enter after verifying/adding the key to GitHub..."
        
        # Test again after user confirms
        GITHUB_TEST=$($SSH_CMD "ssh -T git@github.com 2>&1" || true)
        if echo "$GITHUB_TEST" | grep -qiE "successfully authenticated|you've successfully authenticated|hi.*you've successfully"; then
            print_info "✓ GitHub SSH is now working"
        else
            print_error "GitHub SSH still not working. Test output: $GITHUB_TEST"
            print_error "Please check the key is added correctly to GitHub."
        fi
    fi
else
        # No existing key, generate a new one
        print_info "No existing GitHub SSH key found. Generating new key..."
        $SSH_CMD "ssh-keygen -t ed25519 -C 'server-github-deploy' -f ~/.ssh/github_deploy -N ''"
        
        SERVER_PUB_KEY=$($SSH_CMD "cat ~/.ssh/github_deploy.pub")
        print_warn "Please add this SSH key to your GitHub account:"
        echo ""
        echo "$SERVER_PUB_KEY"
        echo ""
        print_warn "Go to: https://github.com/settings/keys"
        print_warn "Click 'New SSH key' and paste the key above"
        read -p "Press Enter after adding the key to GitHub..."
        
        # Configure SSH to use this key for GitHub
        $SSH_CMD "cat >> ~/.ssh/config << 'EOF'
Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/github_deploy
    IdentitiesOnly yes
    StrictHostKeyChecking=no
EOF
chmod 600 ~/.ssh/config"
        
        # Final test
        GITHUB_TEST=$($SSH_CMD "ssh -T git@github.com 2>&1" || true)
        if echo "$GITHUB_TEST" | grep -qiE "successfully authenticated|you've successfully authenticated|hi.*you've successfully"; then
            print_info "✓ GitHub SSH configured successfully"
        else
            print_warn "GitHub SSH test failed. You may need to add the key manually."
        fi
fi

# Step 5: Clone or update repository on server
print_info "Step 5: Setting up repository on server..."

if $SSH_CMD "[ -d $SERVER_APP_DIR/.git ]"; then
    print_info "Repository exists. Updating..."
    # Ensure known_hosts is set up before fetching
    $SSH_CMD "mkdir -p ~/.ssh && ssh-keyscan -t rsa,ed25519 github.com >> ~/.ssh/known_hosts 2>/dev/null || true"
    $SSH_CMD "cd $SERVER_APP_DIR && GIT_SSH_COMMAND='ssh -o StrictHostKeyChecking=accept-new' git fetch origin && git reset --hard origin/$CURRENT_BRANCH"
else
    print_info "Cloning repository..."
    # Ensure known_hosts is set up and clone with proper SSH config
    $SSH_CMD "mkdir -p $(dirname $SERVER_APP_DIR) && \
              mkdir -p ~/.ssh && \
              ssh-keyscan -t rsa,ed25519 github.com >> ~/.ssh/known_hosts 2>/dev/null && \
              GIT_SSH_COMMAND='ssh -o StrictHostKeyChecking=accept-new' git clone $GITHUB_REPO $SERVER_APP_DIR"
    $SSH_CMD "cd $SERVER_APP_DIR && git checkout $CURRENT_BRANCH 2>/dev/null || true"
fi

print_info "✓ Repository updated on server"

# Step 6: Install dependencies and build
print_info "Step 6: Installing dependencies and building..."

$SSH_CMD "cd $SERVER_APP_DIR && npm install" || {
    print_error "Failed to install dependencies"
    exit 1
}

print_info "✓ Dependencies installed"

# Build the project
print_info "Building project..."
$SSH_CMD "cd $SERVER_APP_DIR && npm run build" || {
    print_error "Build failed"
    exit 1
}

print_info "✓ Project built successfully"

# Step 6.5: Ensure .env file exists on server and copy to service directories
print_info "Checking for .env file on server..."
if ! $SSH_CMD "[ -f $SERVER_APP_DIR/.env ]"; then
    print_warn ".env file not found on server. Creating from template..."
    print_warn "Please ensure DATABASE_URL and other environment variables are set correctly."
    $SSH_CMD "cd $SERVER_APP_DIR && touch .env"
    print_warn "You may need to manually configure .env file on the server with database credentials."
else
    print_info "✓ .env file exists on server"
    # Copy .env to each service directory so dotenv.config() can find it
    print_info "Copying .env to service directories..."
    $SSH_CMD "cp $SERVER_APP_DIR/.env $SERVER_APP_DIR/services/merchant-onboarding-service/.env 2>/dev/null || true"
    $SSH_CMD "cp $SERVER_APP_DIR/.env $SERVER_APP_DIR/services/payment-processing-service/.env 2>/dev/null || true"
    $SSH_CMD "cp $SERVER_APP_DIR/.env $SERVER_APP_DIR/services/transaction-monitoring-service/.env 2>/dev/null || true"
    $SSH_CMD "cp $SERVER_APP_DIR/.env $SERVER_APP_DIR/services/settlement-reporting-service/.env 2>/dev/null || true"
    print_info "✓ .env files copied to service directories"
fi

# Step 7: Setup PM2 and start services
print_info "Step 7: Setting up PM2 and starting services..."

# Check if PM2 is installed
if ! $SSH_CMD "command -v pm2 >/dev/null 2>&1"; then
    print_info "Installing PM2..."
    $SSH_CMD "npm install -g pm2"
    print_info "✓ PM2 installed"
else
    print_info "✓ PM2 is already installed"
fi

# Stop existing PM2 processes if any
print_info "Stopping existing services..."
$SSH_CMD "cd $SERVER_APP_DIR && pm2 delete all 2>/dev/null || true"
$SSH_CMD "cd $SERVER_APP_DIR && pm2 kill 2>/dev/null || true"

# Start services with PM2
print_info "Starting services with PM2..."

# Start Merchant Onboarding Service (port 3001)
$SSH_CMD "cd $SERVER_APP_DIR && pm2 start $SERVER_APP_DIR/services/merchant-onboarding-service/dist/index.js --name merchant-onboarding --cwd $SERVER_APP_DIR/services/merchant-onboarding-service" || {
    print_error "Failed to start merchant-onboarding service"
}

# Start Payment Processing Service (port 3002)
$SSH_CMD "cd $SERVER_APP_DIR && pm2 start $SERVER_APP_DIR/services/payment-processing-service/dist/index.js --name payment-processing --cwd $SERVER_APP_DIR/services/payment-processing-service" || {
    print_error "Failed to start payment-processing service"
}

# Start Transaction Monitoring Service (port 3003)
$SSH_CMD "cd $SERVER_APP_DIR && pm2 start $SERVER_APP_DIR/services/transaction-monitoring-service/dist/index.js --name transaction-monitoring --cwd $SERVER_APP_DIR/services/transaction-monitoring-service" || {
    print_error "Failed to start transaction-monitoring service"
}

# Start Settlement Reporting Service (port 3004)
$SSH_CMD "cd $SERVER_APP_DIR && pm2 start $SERVER_APP_DIR/services/settlement-reporting-service/dist/index.js --name settlement-reporting --cwd $SERVER_APP_DIR/services/settlement-reporting-service" || {
    print_error "Failed to start settlement-reporting service"
}

# Save PM2 configuration
print_info "Saving PM2 configuration..."
$SSH_CMD "cd $SERVER_APP_DIR && pm2 save"
$SSH_CMD "cd $SERVER_APP_DIR && pm2 startup 2>/dev/null || true"

# Show PM2 status
print_info "PM2 Status:"
$SSH_CMD "cd $SERVER_APP_DIR && pm2 list"

# Wait a bit for services to start
print_info "Waiting for services to start..."
sleep 5

# Show PM2 status again
print_info "PM2 Status after startup:"
$SSH_CMD "cd $SERVER_APP_DIR && pm2 list"

# Check PM2 logs for errors
print_info "Checking PM2 logs for errors (last 30 lines)..."
$SSH_CMD "cd $SERVER_APP_DIR && pm2 logs --lines 30 --nostream --err" || true

# Check if any services are errored
ERRORED_SERVICES=$($SSH_CMD "cd $SERVER_APP_DIR && pm2 jlist | grep -o '\"status\":\"errored\"' | wc -l" || echo "0")
if [ "$ERRORED_SERVICES" != "0" ] && [ "$ERRORED_SERVICES" != "" ]; then
    print_error "Some services have errored. Showing detailed logs..."
    $SSH_CMD "cd $SERVER_APP_DIR && pm2 logs --lines 50 --nostream" || true
fi

# Step 8: Test health endpoints
print_info "Step 8: Testing health endpoints..."

# Test each service health endpoint
SERVICES=(
    "merchant-onboarding:3001"
    "payment-processing:3002"
    "transaction-monitoring:3003"
    "settlement-reporting:3004"
)

HEALTH_CHECK_FAILED=0

for service in "${SERVICES[@]}"; do
    SERVICE_NAME=$(echo $service | cut -d':' -f1)
    PORT=$(echo $service | cut -d':' -f2)
    
    print_info "Testing $SERVICE_NAME health endpoint (port $PORT)..."
    HEALTH_RESPONSE=$($SSH_CMD "curl -s -o /dev/null -w '%{http_code}' http://localhost:$PORT/health || echo '000'")
    
    if [ "$HEALTH_RESPONSE" = "200" ]; then
        print_info "✓ $SERVICE_NAME is healthy (HTTP $HEALTH_RESPONSE)"
        # Get full response
        HEALTH_BODY=$($SSH_CMD "curl -s http://localhost:$PORT/health")
        print_info "  Response: $HEALTH_BODY"
    else
        print_error "✗ $SERVICE_NAME health check failed (HTTP $HEALTH_RESPONSE)"
        HEALTH_CHECK_FAILED=1
    fi
done

# Step 9: Summary
echo ""
print_info "=========================================="
print_info "Deployment completed successfully!"
print_info "=========================================="
print_info "Repository: $GITHUB_REPO"
print_info "Branch: $CURRENT_BRANCH"
print_info "Server: $SERVER_USER@$SERVER_IP"
print_info "App Directory: $SERVER_APP_DIR"
echo ""
print_info "Services are running with PM2"
print_info ""
print_info "Service URLs:"
print_info "  - Merchant Onboarding: http://$SERVER_IP:3001/health"
print_info "  - Payment Processing: http://$SERVER_IP:3002/health"
print_info "  - Transaction Monitoring: http://$SERVER_IP:3003/health"
print_info "  - Settlement Reporting: http://$SERVER_IP:3004/health"
print_info ""
print_info "API Documentation (Swagger):"
print_info "  - Merchant Onboarding: http://$SERVER_IP:3001/api-docs"
print_info "  - Payment Processing: http://$SERVER_IP:3002/api-docs"
print_info "  - Transaction Monitoring: http://$SERVER_IP:3003/api-docs"
print_info "  - Settlement Reporting: http://$SERVER_IP:3004/api-docs"
print_info ""
print_info "PM2 Commands:"
print_info "  - View status: ssh -i $SERVER_SSH_KEY $SERVER_USER@$SERVER_IP 'cd $SERVER_APP_DIR && pm2 list'"
print_info "  - View logs: ssh -i $SERVER_SSH_KEY $SERVER_USER@$SERVER_IP 'cd $SERVER_APP_DIR && pm2 logs'"
print_info "  - Restart all: ssh -i $SERVER_SSH_KEY $SERVER_USER@$SERVER_IP 'cd $SERVER_APP_DIR && pm2 restart all'"
echo ""

if [ $HEALTH_CHECK_FAILED -eq 1 ]; then
    print_warn "Some health checks failed. Please check PM2 logs:"
    print_warn "  ssh -i $SERVER_SSH_KEY $SERVER_USER@$SERVER_IP 'cd $SERVER_APP_DIR && pm2 logs'"
    exit 1
else
    print_info "✓ All health checks passed!"
fi
echo ""

