const db = require('../src/config/db');

async function seedNewProducts() {
  console.log('Seeding 6 new products (2 Variable, 2 Customisable, 2 Project)...');

  try {
    // Get highest existing product ID so we don't collide
    const [{ maxId }] = await db.query('SELECT COALESCE(MAX(id), 0) AS maxId FROM products');
    let nextId = Number(maxId) + 1;

    // Grab a valid category ID to use as default
    const cats = await db.query('SELECT id FROM categories ORDER BY id ASC LIMIT 1');
    const defaultCat = cats.length > 0 ? cats[0].id : 1;

    // ---------- PRODUCTS ----------
    const products = [
      // --- VARIABLE (2) ---
      {
        categoryId: defaultCat,
        itemType: 'PRODUCT',
        productType: 'VARIABLE',
        name: 'Personalised Cushion',
        slug: 'personalised-cushion',
        description: 'A soft, high-quality photo-print cushion. Available in multiple sizes and fill types. Upload your favourite photo and choose your size.',
        basePrice: 549.00,
        status: 'ACTIVE',
        image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?q=80&w=600&auto=format&fit=crop',
        variants: [
          { sku: 'CUSHION-12X12', attributes: { Size: '12×12 inch' }, priceOverride: 549.00, stockQty: 100 },
          { sku: 'CUSHION-14X14', attributes: { Size: '14×14 inch' }, priceOverride: 649.00, stockQty: 80 },
          { sku: 'CUSHION-16X16', attributes: { Size: '16×16 inch' }, priceOverride: 749.00, stockQty: 60 },
        ],
        customFields: []
      },
      {
        categoryId: defaultCat,
        itemType: 'PRODUCT',
        productType: 'VARIABLE',
        name: 'Scented Soy Candle',
        slug: 'scented-soy-candle',
        description: 'Hand-poured 100% natural soy wax candle with premium fragrance oils. Available in multiple scents and jar sizes. Burns clean for up to 60 hours.',
        basePrice: 399.00,
        status: 'ACTIVE',
        image: 'https://images.unsplash.com/photo-1608181831718-c9e4f7f7b9b5?q=80&w=600&auto=format&fit=crop',
        variants: [
          { sku: 'CANDLE-ROSE-SM',    attributes: { Scent: 'Rose',     Size: 'Small (150g)'  }, priceOverride: 399.00, stockQty: 50 },
          { sku: 'CANDLE-ROSE-LG',    attributes: { Scent: 'Rose',     Size: 'Large (300g)'  }, priceOverride: 699.00, stockQty: 40 },
          { sku: 'CANDLE-JASMINE-SM', attributes: { Scent: 'Jasmine',  Size: 'Small (150g)'  }, priceOverride: 399.00, stockQty: 50 },
          { sku: 'CANDLE-JASMINE-LG', attributes: { Scent: 'Jasmine',  Size: 'Large (300g)'  }, priceOverride: 699.00, stockQty: 40 },
          { sku: 'CANDLE-VANILLA-SM', attributes: { Scent: 'Vanilla',  Size: 'Small (150g)'  }, priceOverride: 399.00, stockQty: 50 },
          { sku: 'CANDLE-VANILLA-LG', attributes: { Scent: 'Vanilla',  Size: 'Large (300g)'  }, priceOverride: 699.00, stockQty: 30 },
        ],
        customFields: []
      },

      // --- CUSTOMISABLE (2) ---
      {
        categoryId: defaultCat,
        itemType: 'PRODUCT',
        productType: 'CUSTOMISABLE',
        name: 'Engraved Wooden Keepsake Box',
        slug: 'engraved-wooden-keepsake-box',
        description: 'A beautiful handcrafted wooden box with laser-engraved personalised text and photo. Perfect for storing memories — jewellery, letters, mementos.',
        basePrice: 1199.00,
        status: 'ACTIVE',
        image: 'https://images.unsplash.com/photo-1607344645866-009c320b63e0?q=80&w=600&auto=format&fit=crop',
        variants: [],
        customFields: [
          { field_key: 'engraving_text', label: 'Engraving Text (Line 1)', type: 'TEXT', required: 1, help_text: 'Max 30 characters for the top line' },
          { field_key: 'engraving_text_2', label: 'Engraving Text (Line 2)', type: 'TEXT', required: 0, help_text: 'Optional second line, max 30 characters' },
          { field_key: 'photo', label: 'Upload Photo (Optional)', type: 'FILE', required: 0, allowed_mime_types: '["image/png","image/jpeg"]', max_file_size_kb: 5000, help_text: 'We will engrave this photo on the lid' },
          { field_key: 'wood_type', label: 'Wood Type', type: 'DROPDOWN', required: 1, options: '["Natural Oak","Walnut Dark","Mahogany"]', help_text: 'Choose your preferred wood finish' },
        ]
      },
      {
        categoryId: defaultCat,
        itemType: 'PRODUCT',
        productType: 'CUSTOMISABLE',
        name: 'Photo Collage Canvas Print',
        slug: 'photo-collage-canvas-print',
        description: 'Turn your favourite moments into a stunning canvas print. Choose a layout, upload photos, and add a personal message. Museum-quality print on premium stretched canvas.',
        basePrice: 1499.00,
        status: 'ACTIVE',
        image: 'https://images.unsplash.com/photo-1549490349-8643362247b5?q=80&w=600&auto=format&fit=crop',
        variants: [],
        customFields: [
          { field_key: 'layout', label: 'Collage Layout', type: 'DROPDOWN', required: 1, options: '["1 Photo (Full Canvas)","2 Photos (Side by Side)","4 Photos (Grid)","6 Photos (Mix)"]', help_text: 'Choose the collage arrangement' },
          { field_key: 'photos', label: 'Upload Photos', type: 'FILE', required: 1, allowed_mime_types: '["image/png","image/jpeg"]', max_file_size_kb: 10000, help_text: 'Upload photos as per your chosen layout' },
          { field_key: 'caption', label: 'Caption / Quote', type: 'TEXT', required: 0, help_text: 'Optional quote or date printed at the bottom' },
          { field_key: 'canvas_size', label: 'Canvas Size', type: 'DROPDOWN', required: 1, options: '["12×16 inch","16×20 inch","20×24 inch","24×36 inch"]', help_text: 'Stretched canvas with wooden frame included' },
        ]
      },

      // --- PROJECT (2) ---
      {
        categoryId: defaultCat,
        itemType: 'PROJECT',
        productType: null,
        name: 'Dried Flower Resin Art Frame',
        slug: 'dried-flower-resin-art-frame',
        description: 'A bespoke made-to-order artwork. Ship us your meaningful flowers (wedding, gifted, memorial) and we will hand-cast them in premium crystal-clear epoxy resin, set in a premium frame.',
        basePrice: 3500.00,
        advanceAmount: 1000.00,
        finalAmount: 2500.00,
        totalAmount: 3500.00,
        materialInstructions: '1. Gently press your flowers between heavy books for 2–3 days until fully dry.\n2. Wrap them carefully in tissue paper — do not use plastic bags.\n3. Place in a rigid cardboard box with padding.\n4. Ship to our studio within 7 days of booking using any courier.\n5. WhatsApp us your tracking number at the number on your confirmation email.',
        status: 'ACTIVE',
        image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=600&auto=format&fit=crop',
        variants: [],
        customFields: []
      },
      {
        categoryId: defaultCat,
        itemType: 'PROJECT',
        productType: null,
        name: 'Hair Lock Preservation Pendant',
        slug: 'hair-lock-preservation-pendant',
        description: 'Preserve a lock of your baby\'s first hair, a pet\'s fur, or a loved one\'s hair inside a hand-crafted sterling silver resin pendant. A deeply personal keepsake to carry close to your heart.',
        basePrice: 2800.00,
        advanceAmount: 800.00,
        finalAmount: 2000.00,
        totalAmount: 2800.00,
        materialInstructions: '1. Cut a small lock of hair (approx 1–2cm bundle).\n2. Place it gently inside a small zip-lock bag labelled with the name.\n3. Place the bag inside a small rigid box and ship to our studio.\n4. Use a courier with tracking — we are not responsible for items lost in transit.',
        status: 'ACTIVE',
        image: 'https://images.unsplash.com/photo-1586864387789-628af9feed72?q=80&w=600&auto=format&fit=crop',
        variants: [],
        customFields: []
      },
    ];

    for (const p of products) {
      const pid = nextId++;
      console.log(`  → Inserting [${p.productType || p.itemType}] #${pid}: ${p.name}`);

      // Insert product
      await db.query(
        `INSERT INTO products (
          id, category_id, item_type, product_type, name, slug, description, base_price,
          advance_amount, final_amount, total_amount, material_instructions, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          pid,
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

      // Insert image
      if (p.image) {
        await db.query(
          'INSERT INTO product_images (product_id, url, is_primary, sort_order) VALUES (?, ?, 1, 1)',
          [pid, p.image]
        );
      }

      // Insert variants
      for (const v of p.variants || []) {
        await db.query(
          `INSERT INTO product_variants (product_id, sku, attributes, price_override, stock_qty, status)
           VALUES (?, ?, ?, ?, ?, 'ACTIVE')`,
          [pid, v.sku, JSON.stringify(v.attributes), v.priceOverride || null, v.stockQty || 0]
        );
      }

      // Insert custom fields
      for (let i = 0; i < (p.customFields || []).length; i++) {
        const f = p.customFields[i];
        await db.query(
          `INSERT INTO product_custom_fields (
            product_id, field_key, label, type, required, options, allowed_mime_types, max_file_size_kb, help_text, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            pid,
            f.field_key,
            f.label,
            f.type,
            f.required || 0,
            f.options || null,
            f.allowed_mime_types || null,
            f.max_file_size_kb || null,
            f.help_text || null,
            i + 1
          ]
        );
      }
    }

    console.log('\n✅ Seeded successfully!');
    console.log(`   2 × VARIABLE  (Personalised Cushion, Scented Soy Candle)`);
    console.log(`   2 × CUSTOMISABLE  (Engraved Wooden Keepsake Box, Photo Collage Canvas Print)`);
    console.log(`   2 × PROJECT  (Dried Flower Resin Art Frame, Hair Lock Preservation Pendant)`);
  } catch (err) {
    console.error('Seeding error:', err);
  } finally {
    process.exit(0);
  }
}

seedNewProducts();
