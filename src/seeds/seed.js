const connectDB = require('../config/db');
const User = require('../models/User');
const Category = require('../models/Category');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const Order = require('../models/Order');

const seedDatabase = async () => {
  try {
    await connectDB();

    console.log('Clearing existing collections...');
    await Promise.all([
      User.deleteMany({}),
      Category.deleteMany({}),
      Product.deleteMany({}),
      Cart.deleteMany({}),
      Order.deleteMany({})
    ]);

    console.log('Creating users (Admin, Sellers, Customers)...');
    const [admin, seller1, seller2, customer1, customer2] = await User.create([
      {
        name: 'Platform Admin',
        email: 'admin@campusstore.com',
        password: 'Password@123',
        role: 'admin'
      },
      {
        name: 'TechZone Seller',
        email: 'seller1@campusstore.com',
        password: 'Password@123',
        role: 'seller'
      },
      {
        name: 'UrbanBooks Seller',
        email: 'seller2@campusstore.com',
        password: 'Password@123',
        role: 'seller'
      },
      {
        name: 'Rohan Sharma',
        email: 'rohan@student.com',
        password: 'Password@123',
        role: 'customer'
      },
      {
        name: 'Ananya Verma',
        email: 'ananya@student.com',
        password: 'Password@123',
        role: 'customer'
      }
    ]);

    console.log('Creating categories...');
    const [electronics, books, accessories] = await Category.create([
      { name: 'Electronics', description: 'Laptops, audio gear, and developer gadgets' },
      { name: 'Books & Study Material', description: 'Computer Science textbooks and guides' },
      { name: 'Desk Accessories', description: 'Ergonomic stands, lamps, and organizers' }
    ]);

    console.log('Creating products...');
    const products = await Product.create([
      {
        name: 'Mechanical Wireless Keyboard',
        description: '75% compact tactile mechanical keyboard with USB-C and Bluetooth',
        price: 4499,
        stock: 15,
        lowStockThreshold: 5,
        category: electronics._id,
        seller: seller1._id
      },
      {
        name: 'Noise Cancelling Studio Headphones',
        description: 'Over-ear wireless headphones with 40-hour battery life',
        price: 6999,
        stock: 4, // Deliberately low stock to demonstrate low-stock alerts
        lowStockThreshold: 5,
        category: electronics._id,
        seller: seller1._id
      },
      {
        name: 'USB-C 7-in-1 Multiport Hub',
        description: 'HDMI 4K, 100W PD charging, SD card reader, and USB 3.0 ports',
        price: 2199,
        stock: 25,
        lowStockThreshold: 5,
        category: electronics._id,
        seller: seller1._id
      },
      {
        name: 'Designing Data-Intensive Applications',
        description: 'Essential guide to distributed systems and backend architecture',
        price: 1850,
        stock: 12,
        lowStockThreshold: 3,
        category: books._id,
        seller: seller2._id
      },
      {
        name: 'Clean Code Handbook',
        description: 'A handbook of agile software craftsmanship',
        price: 1299,
        stock: 20,
        lowStockThreshold: 4,
        category: books._id,
        seller: seller2._id
      },
      {
        name: 'Aluminum Laptop Riser Stand',
        description: 'Ergonomic foldable aluminum stand for MacBook and laptops',
        price: 1499,
        stock: 8,
        lowStockThreshold: 3,
        category: accessories._id,
        seller: seller1._id
      }
    ]);

    console.log('Creating a sample completed order for analytics...');
    await Order.create({
      orderNumber: 'ORD-20261122-SAMPLE1',
      customer: customer1._id,
      items: [
        {
          product: products[0]._id,
          seller: seller1._id,
          nameSnapshot: products[0].name,
          priceSnapshot: products[0].price,
          quantity: 1
        },
        {
          product: products[3]._id,
          seller: seller2._id,
          nameSnapshot: products[3].name,
          priceSnapshot: products[3].price,
          quantity: 2
        }
      ],
      totalAmount: 4499 + 1850 * 2,
      shippingAddress: {
        street: 'Hostel Block B, Room 204',
        city: 'Gurugram',
        state: 'Haryana',
        postalCode: '122103',
        country: 'India'
      },
      paymentMethod: 'SIMULATED_UPI',
      paymentStatus: 'SIMULATED_PAID',
      orderStatus: 'DELIVERED'
    });

    console.log('\nSeed completed successfully!');
    console.log('Sample Credentials (Password for all: Password@123):');
    console.log('  Admin    : admin@campusstore.com');
    console.log('  Seller 1 : seller1@campusstore.com');
    console.log('  Seller 2 : seller2@campusstore.com');
    console.log('  Customer : rohan@student.com');
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
};

seedDatabase();