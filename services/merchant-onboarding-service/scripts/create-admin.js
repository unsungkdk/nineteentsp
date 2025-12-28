#!/usr/bin/env node
/**
 * Script to create admin user
 * Usage: node scripts/create-admin.js <email> <password> <name> [role]
 * Example: node scripts/create-admin.js admin@nineteenpay.com 'MyPassword123!' 'Admin User' admin
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function createAdmin(email, password, name, role = 'admin') {
  try {
    // Check if admin already exists
    const existing = await prisma.admin.findUnique({
      where: { email },
    });

    if (existing) {
      console.error(`Admin with email ${email} already exists.`);
      process.exit(1);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create admin
    const admin = await prisma.admin.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role,
        isActive: true,
        isEmailVerified: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    console.log('Admin created successfully:');
    console.log(JSON.stringify(admin, null, 2));
  } catch (error) {
    console.error('Error creating admin:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Get command line arguments
const args = process.argv.slice(2);

if (args.length < 3) {
  console.error('Usage: node scripts/create-admin.js <email> <password> <name> [role]');
  console.error('Example: node scripts/create-admin.js admin@nineteenpay.com "MyPassword123!" "Admin User" admin');
  process.exit(1);
}

const [email, password, name, role = 'admin'] = args;

createAdmin(email, password, name, role);

