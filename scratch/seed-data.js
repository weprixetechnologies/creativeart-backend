const db = require('../src/config/db');

async function seed() {
  console.log('Starting DB Seeding...');
  
  try {
    // 1. Clear existing data
    console.log('Clearing old categories and products...');
    await db.query('DELETE FROM product_reviews');
    await db.query('DELETE FROM wishlists');
    await db.query('DELETE FROM product_custom_fields');
    await db.query('DELETE FROM product_variants');
    await db.query('DELETE FROM product_images');
    await db.query('DELETE FROM products');
    await db.query('DELETE FROM categories');
    
    // 2. Insert Categories
    console.log('Inserting categories...');
    const categoryData = [
      { id: 1, name: 'Personalised Gifts', slug: 'personalised-gifts', sort_order: 1 },
      { id: 2, name: 'Birthday Gifts', slug: 'birthday-gifts', sort_order: 2 },
      { id: 3, name: 'Anniversary Gifts', slug: 'anniversary-gifts', sort_order: 3 },
      { id: 4, name: 'Flowers', slug: 'flowers', sort_order: 4 },
      { id: 5, name: 'Chocolates', slug: 'chocolates', sort_order: 5 },
      { id: 6, name: 'Home Decor', slug: 'home-decor', sort_order: 6 },
      { id: 7, name: 'Gift Hampers', slug: 'gift-hampers', sort_order: 7 },
      { id: 8, name: 'Combo Offers', slug: 'combo-offers', sort_order: 8 }
    ];
    
    for (const cat of categoryData) {
      await db.query(
        'INSERT INTO categories (id, name, slug, sort_order, status) VALUES (?, ?, ?, ?, "ACTIVE")',
        [cat.id, cat.name, cat.slug, cat.sort_order]
      );
    }
    
    // 3. Insert Products
    console.log('Inserting products...');
    const productsData = [
      {
        id: 1,
        categoryId: 1,
        itemType: 'PRODUCT',
        productType: 'CUSTOMISABLE',
        name: 'Personalised Photo Lamp',
        slug: 'personalised-photo-lamp',
        description: 'Add your favourite memories to light up your special moments. A perfect personalised gift for your loved ones. Built with bright & warm LED, high resolution print, and custom shapes.',
        basePrice: 799.00,
        status: 'ACTIVE'
      },
      {
        id: 2,
        categoryId: 7,
        itemType: 'PRODUCT',
        productType: 'SIMPLE',
        name: 'Love & Care Hamper',
        slug: 'love-and-care-hamper',
        description: 'A beautiful luxury gift hamper packed with organic spa items, premium scented candles, and organic hand creams. Specially curated for your special someone.',
        basePrice: 1299.00,
        status: 'ACTIVE'
      },
      {
        id: 3,
        categoryId: 1,
        itemType: 'PRODUCT',
        productType: 'SIMPLE',
        name: 'Rose Teddy Bear',
        slug: 'rose-teddy-bear',
        description: 'Handcrafted rose flower teddy bear. Made of soft artificial roses that last forever. Perfect romantic gift for Valentine\'s Day or anniversaries.',
        basePrice: 999.00,
        status: 'ACTIVE'
      },
      {
        id: 4,
        categoryId: 1,
        itemType: 'PRODUCT',
        productType: 'CUSTOMISABLE',
        name: 'Personalised Couple Mug',
        slug: 'personalised-couple-mug',
        description: 'A set of two custom printed ceramic mugs with your names and photos. Microwave safe, high gloss finish, premium quality print.',
        basePrice: 499.00,
        status: 'ACTIVE'
      },
      {
        id: 5,
        categoryId: 1,
        itemType: 'PRODUCT',
        productType: 'CUSTOMISABLE',
        name: 'Explosion Photo Box',
        slug: 'explosion-photo-box',
        description: 'A handmade multi-layered explosion gift box. Opens up to reveal multiple photos, slots for chocolate, and custom messages. The ultimate surprise gift.',
        basePrice: 899.00,
        status: 'ACTIVE'
      },
      {
        id: 6,
        categoryId: 4,
        itemType: 'PRODUCT',
        productType: 'SIMPLE',
        name: 'Pink Lily Bouquet',
        slug: 'pink-lily-bouquet',
        description: 'A stunning fresh bouquet of premium pink lilies and seasonal foliage, wrapped in matching paper. Beautifully crafted by local florists.',
        basePrice: 899.00,
        status: 'ACTIVE'
      },
      {
        id: 7,
        categoryId: 5,
        itemType: 'PRODUCT',
        productType: 'SIMPLE',
        name: 'Premium Chocolates Box',
        slug: 'premium-chocolates-box',
        description: 'An assortment of 16 handcrafted Belgian dark, milk, and white chocolate truffles. Packaged in a luxury gold-embossed box.',
        basePrice: 649.00,
        status: 'ACTIVE'
      },
      {
        id: 8,
        categoryId: 6,
        itemType: 'PRODUCT',
        productType: 'SIMPLE',
        name: 'Aroma Diffuser',
        slug: 'aroma-diffuser',
        description: 'Ultrasonic cool mist humidifier and essential oil diffuser. Features a beautiful light wood grain finish and 7-color LED lights.',
        basePrice: 1199.00,
        status: 'ACTIVE'
      },
      {
        id: 9,
        categoryId: 7,
        itemType: 'PRODUCT',
        productType: 'SIMPLE',
        name: 'Luxury Gift Hamper',
        slug: 'luxury-gift-hamper',
        description: 'The ultimate luxury hamper. Includes premium sparkling juice, imported cheese crackers, chocolate truffles, a personalized mug, and fresh roses.',
        basePrice: 2199.00,
        status: 'ACTIVE'
      },
      {
        id: 10,
        categoryId: 6,
        itemType: 'PRODUCT',
        productType: 'SIMPLE',
        name: 'Love Forever Showpiece',
        slug: 'love-forever-showpiece',
        description: 'A handcrafted golden couple figurine/showpiece. Perfect home decor accent symbolising eternal love and togetherness.',
        basePrice: 849.00,
        status: 'ACTIVE'
      },
      {
        id: 11,
        categoryId: 1,
        itemType: 'PRODUCT',
        productType: 'SIMPLE',
        name: 'Handmade Greeting Card',
        slug: 'handmade-greeting-card',
        description: 'A beautiful handcrafted 3D pop-up greeting card. Features intricate laser-cut floral details and space for custom handwritten text.',
        basePrice: 199.00,
        status: 'ACTIVE'
      },
      {
        id: 12,
        categoryId: 8,
        itemType: 'PRODUCT',
        productType: 'SIMPLE',
        name: 'Gift Combo Set',
        slug: 'gift-combo-set',
        description: 'Best seller combo set. Includes a personalized photo lamp, custom printed mug, and a box of chocolates. Perfect all-in-one celebration kit.',
        basePrice: 1499.00,
        status: 'ACTIVE'
      },
      {
        id: 13,
        categoryId: 3,
        itemType: 'PROJECT',
        productType: null,
        name: 'Wedding Bouquet Preservation Frame',
        slug: 'wedding-bouquet-preservation-frame',
        description: 'Dual-payment project. Preserve your wedding flowers forever inside a premium glass frame. Ship your flowers to us after booking.',
        basePrice: 4500.00,
        advanceAmount: 1500.00,
        finalAmount: 3000.00,
        totalAmount: 4500.00,
        materialInstructions: '1. Wrap your fresh flowers in dry paper towels.\n2. Place them in a ventilated box.\n3. Ship them to our workshop within 3 days of your wedding.',
        status: 'ACTIVE'
      }
    ];
    
    for (const p of productsData) {
      await db.query(
        `INSERT INTO products (
          id, category_id, item_type, product_type, name, slug, description, base_price,
          advance_amount, final_amount, total_amount, material_instructions, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          p.id,
          p.categoryId,
          p.itemType,
          p.productType,
          p.name,
          p.slug,
          p.description,
          p.basePrice,
          p.advanceAmount || null,
          p.finalAmount || null,
          p.totalAmount || null,
          p.materialInstructions || null,
          p.status
        ]
      );
    }
    
    // 4. Insert Images
    console.log('Inserting product images...');
    const imagesData = [
      { productId: 1, url: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?q=80&w=600&auto=format&fit=crop', is_primary: 1 },
      { productId: 2, url: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?q=80&w=600&auto=format&fit=crop', is_primary: 1 },
      { productId: 3, url: 'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?q=80&w=600&auto=format&fit=crop', is_primary: 1 },
      { productId: 4, url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=600&auto=format&fit=crop', is_primary: 1 },
      { productId: 5, url: 'https://images.unsplash.com/photo-1512909006721-3d6018887383?q=80&w=600&auto=format&fit=crop', is_primary: 1 },
      { productId: 6, url: 'https://images.unsplash.com/photo-1561181286-d3fee7d55364?q=80&w=600&auto=format&fit=crop', is_primary: 1 },
      { productId: 7, url: 'https://images.unsplash.com/photo-1548907040-4d42b52115ca?q=80&w=600&auto=format&fit=crop', is_primary: 1 },
      { productId: 8, url: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?q=80&w=600&auto=format&fit=crop', is_primary: 1 },
      { productId: 9, url: 'https://images.unsplash.com/photo-1513201099705-a9746e1e201f?q=80&w=600&auto=format&fit=crop', is_primary: 1 },
      { productId: 10, url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?q=80&w=600&auto=format&fit=crop', is_primary: 1 },
      { productId: 11, url: 'https://images.unsplash.com/photo-1516962215378-7fa2e137ae93?q=80&w=600&auto=format&fit=crop', is_primary: 1 },
      { productId: 12, url: 'https://images.unsplash.com/photo-1523293182086-7651a899d37f?q=80&w=600&auto=format&fit=crop', is_primary: 1 },
      { productId: 13, url: 'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?q=80&w=600&auto=format&fit=crop', is_primary: 1 }
    ];
    
    for (const img of imagesData) {
      await db.query(
        'INSERT INTO product_images (product_id, url, is_primary, sort_order) VALUES (?, ?, ?, 0)',
        [img.productId, img.url, img.is_primary]
      );
    }
    
    // 5. Insert Custom Fields
    console.log('Inserting product custom fields...');
    const customFieldsData = [
      // Personalised Photo Lamp custom fields
      { productId: 1, field_key: 'shape', label: 'Choose Shape', type: 'DROPDOWN', required: 1, options: '["Heart","Square","Circle"]', help_text: 'Choose the overall wooden lamp block shape' },
      { productId: 1, field_key: 'photos', label: 'Upload Your Photos', type: 'FILE', required: 1, allowed_mime_types: '["image/png","image/jpeg"]', max_file_size_kb: 5000, help_text: 'Best results with high-resolution square photos' },
      { productId: 1, field_key: 'text', label: 'Add Personalisation (Optional)', type: 'TEXT', required: 0, help_text: 'Max 25 characters engraved on wood' },
      { productId: 1, field_key: 'color', label: 'Choose Light Color', type: 'DROPDOWN', required: 1, options: '["Warm White","Cool White"]', help_text: 'Light emission color temperature' },
      
      // Personalised Couple Mug custom fields
      { productId: 4, field_key: 'photos', label: 'Upload Photos', type: 'FILE', required: 1, allowed_mime_types: '["image/png","image/jpeg"]', max_file_size_kb: 5000 },
      { productId: 4, field_key: 'names', label: 'Names to Print', type: 'TEXT', required: 1, help_text: 'E.g., Olivia & James' }
    ];
    
    for (const f of customFieldsData) {
      await db.query(
        `INSERT INTO product_custom_fields (
          product_id, field_key, label, type, required, options, allowed_mime_types, max_file_size_kb, help_text, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          f.productId,
          f.field_key,
          f.label,
          f.type,
          f.required,
          f.options || null,
          f.allowed_mime_types || null,
          f.max_file_size_kb || null,
          f.help_text || null
        ]
      );
    }
    
    // 6. Ensure default user exists for reviews
    console.log('Ensuring default user for reviews...');
    let users = await db.query('SELECT id FROM users WHERE email = ?', ['sophia@example.com']);
    let userId;
    if (users.length > 0) {
      userId = users[0].id;
    } else {
      const res = await db.query(
        `INSERT INTO users (name, email, password_hash, role, status) 
         VALUES (?, ?, ?, 'CUSTOMER', 'ACTIVE')`,
        ['Sophia Patel', 'sophia@example.com', '$2b$10$h.B.f.VfB5E4g6Wd7k9L1.L51x3x2.O0Ww7k5e6r7t8y9u0i1o2p3', 'CUSTOMER']
      );
      userId = res.insertId;
    }

    // 7. Insert Reviews
    console.log('Inserting product reviews...');
    const reviewsData = [
      { productId: 1, user_id: userId, rating: 5, title: 'Absolutely stunning lamp!', comment: 'The picture print quality is crisp and clear, and the warm white light makes my bedroom feel so cozy. Worth every rupee! Fast shipping too.' },
      { productId: 1, user_id: userId, rating: 5, title: 'Perfect Anniversary Gift', comment: 'Ordered this for my wife for our 2nd anniversary. She absolutely loved the Heart shape option with our photo. Highly recommend this store.' },
      { productId: 1, user_id: userId, rating: 4, title: 'Great print quality', comment: 'Overall very nice lamp. Engraving is perfect. Took 4 days to arrive, but packing was extremely secure.' },
      { productId: 2, user_id: userId, rating: 5, title: 'Amazing Hamper', comment: 'Curated so nicely. The candle smells amazing and the items inside are high quality.' }
    ];
    
    for (const r of reviewsData) {
      await db.query(
        'INSERT INTO product_reviews (product_id, user_id, rating, title, comment, status) VALUES (?, ?, ?, ?, ?, "APPROVED")',
        [r.productId, r.user_id, r.rating, r.title, r.comment]
      );
    }
    
    console.log('DB Seeding completed successfully!');
  } catch (err) {
    console.error('Error seeding database:', err);
  } finally {
    process.exit(0);
  }
}

seed();
