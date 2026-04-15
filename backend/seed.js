import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import './config/loadEnv.js';

import User from './models/User.js';

const seedDatabase = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/liquor_pos_db');
    console.log('MongoDB Connected...');

    // Clear existing users (optional - comment out if you want to keep existing users)
    // await User.deleteMany({});
    // console.log('Existing users cleared');

    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
        
    const adminUser = await User.findOneAndUpdate(
      { username: 'admin' },
      {
        username: 'admin',
        password: hashedPassword,
        email: 'admin@liquorpos.com',
        role: 'admin',
        permissions: { all: true },
        is_active: true
      },
      { upsert: true, new: true }
    );
    
    console.log('✅ Admin user created/updated:');
    console.log('   Username: admin');
    console.log('   Password: admin123');
    console.log('   Role: Admin');
    console.log('   ID:', adminUser._id);

    // Create sample cashier user
    const cashierPassword = await bcrypt.hash('cashier123', 10);
    const cashierUser = await User.findOneAndUpdate(
      { username: 'cashier' },
      {
        username: 'cashier',
        password: cashierPassword,
        email: 'cashier@liquorpos.com',
        role: 'cashier',
        permissions: { pos: true },
        is_active: true
      },
      { upsert: true, new: true }
    );

    console.log('\n✅ Cashier user created:');
    console.log('   Username: cashier');
    console.log('   Password: cashier123');
    console.log('   Role: Cashier');

    // Close connection
    await mongoose.connection.close();
    console.log('\nDatabase seeding completed successfully!');
    
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();
