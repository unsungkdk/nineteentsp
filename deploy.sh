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

# Step 3: Setup GitHub SSH on server (if needed)
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
    
    # Test GitHub SSH connection by trying to access the repo
    print_info "Testing GitHub SSH connection..."
    
    # First, try a simple git operation to test if SSH works
    # If repo exists, try to fetch; if not, try to clone (dry run)
    if $SSH_CMD "[ -d $SERVER_APP_DIR/.git ]"; then
        # Repo exists, test by fetching
        GITHUB_TEST=$($SSH_CMD "cd $SERVER_APP_DIR && GIT_SSH_COMMAND='ssh -o StrictHostKeyChecking=accept-new' git ls-remote $GITHUB_REPO 2>&1" || true)
    else
        # Repo doesn't exist, test by trying to list remote
        GITHUB_TEST=$($SSH_CMD "GIT_SSH_COMMAND='ssh -o StrictHostKeyChecking=accept-new' git ls-remote $GITHUB_REPO 2>&1" || true)
    fi
    
    # Check if git operation succeeded (no permission denied errors)
    if echo "$GITHUB_TEST" | grep -qiE "Permission denied|publickey|Could not read from remote"; then
        print_warn "GitHub SSH authentication failed."
        SERVER_PUB_KEY=$($SSH_CMD "cat ~/.ssh/github_deploy.pub")
        print_warn "Please verify this key is added to your GitHub account:"
        echo ""
        echo "$SERVER_PUB_KEY"
        echo ""
        print_warn "Go to: https://github.com/settings/keys"
        read -p "Press Enter after verifying/adding the key to GitHub..."
        
        # Test again after user confirms
        if $SSH_CMD "[ -d $SERVER_APP_DIR/.git ]"; then
            GITHUB_TEST=$($SSH_CMD "cd $SERVER_APP_DIR && GIT_SSH_COMMAND='ssh -o StrictHostKeyChecking=accept-new' git ls-remote $GITHUB_REPO 2>&1" || true)
        else
            GITHUB_TEST=$($SSH_CMD "GIT_SSH_COMMAND='ssh -o StrictHostKeyChecking=accept-new' git ls-remote $GITHUB_REPO 2>&1" || true)
        fi
        
        if echo "$GITHUB_TEST" | grep -qiE "Permission denied|publickey|Could not read from remote"; then
            print_error "GitHub SSH still not working. Please check the key is added correctly."
        else
            print_info "✓ GitHub SSH is now working"
        fi
    else
        print_info "✓ GitHub SSH is working correctly"
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
        
        # Final test by trying to access the repo
        GITHUB_TEST=$($SSH_CMD "GIT_SSH_COMMAND='ssh -o StrictHostKeyChecking=accept-new' git ls-remote $GITHUB_REPO 2>&1" || true)
        if echo "$GITHUB_TEST" | grep -qiE "Permission denied|publickey|Could not read from remote"; then
            print_warn "GitHub SSH test failed. You may need to add the key manually."
        else
            print_info "✓ GitHub SSH configured successfully"
        fi
fi

# Step 4: Update repository on server with latest code
print_info "Step 4: Updating repository with latest code..."

# Ensure known_hosts is set up
$SSH_CMD "mkdir -p ~/.ssh && ssh-keyscan -t rsa,ed25519 github.com >> ~/.ssh/known_hosts 2>/dev/null || true"

# Check if directory exists and is a git repository
if $SSH_CMD "[ -d $SERVER_APP_DIR/.git ]"; then
    print_info "Repository exists. Pulling latest code..."
    $SSH_CMD "cd $SERVER_APP_DIR && GIT_SSH_COMMAND='ssh -o StrictHostKeyChecking=accept-new' git fetch origin && git reset --hard origin/$CURRENT_BRANCH"
    print_info "✓ Repository updated with latest code"
else
    # Directory exists but is not a git repo, remove it and clone fresh
    if $SSH_CMD "[ -d $SERVER_APP_DIR ]"; then
        print_info "Directory exists but is not a git repository. Removing and cloning fresh..."
        $SSH_CMD "rm -rf $SERVER_APP_DIR"
    fi
    
    print_info "Cloning repository..."
    $SSH_CMD "mkdir -p $(dirname $SERVER_APP_DIR) && \
              GIT_SSH_COMMAND='ssh -o StrictHostKeyChecking=accept-new' git clone $GITHUB_REPO $SERVER_APP_DIR"
    $SSH_CMD "cd $SERVER_APP_DIR && git checkout $CURRENT_BRANCH 2>/dev/null || true"
    print_info "✓ Repository cloned"
fi

# Step 5: Install dependencies and build
print_info "Step 5: Installing dependencies and building..."

$SSH_CMD "cd $SERVER_APP_DIR && npm install" || {
    print_error "Failed to install dependencies"
    exit 1
}

print_info "✓ Dependencies installed"

# Generate Prisma client (must run from service directory)
print_info "Generating Prisma client..."
$SSH_CMD "cd $SERVER_APP_DIR/services/merchant-onboarding-service && npx prisma generate" || {
    print_error "Failed to generate Prisma client"
    exit 1
}
print_info "✓ Prisma client generated"

# Build the project
print_info "Building project..."
# Clean old build output for merchant-onboarding-service
$SSH_CMD "cd $SERVER_APP_DIR && rm -rf services/merchant-onboarding-service/dist" || true

$SSH_CMD "cd $SERVER_APP_DIR && npm run build" || {
    print_error "Build failed"
    exit 1
}

print_info "✓ Project built successfully"

# Step 6: Restart services with PM2
print_info "Step 6: Restarting services with PM2..."

# Create logs directory for Winston logs (if needed)
$SSH_CMD "cd $SERVER_APP_DIR && mkdir -p services/merchant-onboarding-service/logs" || true

# Restart services with PM2
print_info "Restarting merchant-onboarding service..."

# Check if merchant-onboarding process exists, restart it; otherwise start it
if $SSH_CMD "cd $SERVER_APP_DIR && pm2 list | grep -q merchant-onboarding"; then
    print_info "Restarting existing merchant-onboarding service..."
    $SSH_CMD "cd $SERVER_APP_DIR && pm2 restart merchant-onboarding" || {
        print_error "Failed to restart merchant-onboarding service"
    }
else
    print_info "Starting merchant-onboarding service (first time)..."
    $SSH_CMD "cd $SERVER_APP_DIR && pm2 start $SERVER_APP_DIR/services/merchant-onboarding-service/dist/index.js --name merchant-onboarding --cwd $SERVER_APP_DIR/services/merchant-onboarding-service" || {
        print_error "Failed to start merchant-onboarding service"
    }
fi

# Save PM2 configuration
print_info "Saving PM2 configuration..."
$SSH_CMD "cd $SERVER_APP_DIR && pm2 save"

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

# Step 7: Test health endpoints
print_info "Step 7: Testing health endpoints..."

# Test each service health endpoint
SERVICES=(
    "merchant-onboarding:3001"
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

# Step 8: Summary
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
print_info ""
print_info "API Documentation (Swagger):"
print_info "  - Merchant Onboarding: http://$SERVER_IP:3001/api-docs"
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

