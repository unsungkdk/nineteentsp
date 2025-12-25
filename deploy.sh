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

if ! $SSH_CMD "ssh -T git@github.com >/dev/null 2>&1"; then
    print_warn "GitHub SSH not configured on server. Setting up..."
    
    # Check if server has SSH key for GitHub
    if ! $SSH_CMD "[ -f ~/.ssh/id_ed25519 ] || [ -f ~/.ssh/id_rsa ]"; then
        print_info "Generating SSH key for GitHub on server..."
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
EOF
chmod 600 ~/.ssh/config"
    fi
    
    # Test GitHub connection
    if $SSH_CMD "ssh -T git@github.com 2>&1 | grep -q 'successfully authenticated'"; then
        print_info "✓ GitHub SSH configured"
    else
        print_warn "GitHub SSH test failed. You may need to add the key manually."
    fi
else
    print_info "✓ GitHub SSH is already configured"
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

# Step 7: Summary
echo ""
print_info "=========================================="
print_info "Deployment completed successfully!"
print_info "=========================================="
print_info "Repository: $GITHUB_REPO"
print_info "Branch: $CURRENT_BRANCH"
print_info "Server: $SERVER_USER@$SERVER_IP"
print_info "App Directory: $SERVER_APP_DIR"
echo ""
print_info "Next steps:"
print_info "1. SSH to server: ssh -i $SERVER_SSH_KEY $SERVER_USER@$SERVER_IP"
print_info "2. Navigate to: cd $SERVER_APP_DIR"
print_info "3. Start services: npm run dev (or configure PM2/systemd)"
echo ""

