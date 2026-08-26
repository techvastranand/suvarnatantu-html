# Suvarnatantu Phase 1 product data guide

All temporary B2B product data is in `assets/js/product-data.js`. Replace its product names, image paths and application lists when official information is approved. Shared customer-facing commercial labels are in `SuvarnatantuCommercialDefaults`.

For each product family, replace only verified fields: image, price, MOQ, colours, denier, TPM, twist, packing, lead time, sample charge, description and application list. The current files intentionally use only safe labels such as **Request Quote**, **Available on Request** and **Confirmed after specification and quantity review**.

Products prepared: M Type, MX Type, ST Type, MH Type, Custom Metallic Yarn, Weaving Zari, Embroidery Zari, Imitation Zari, Polyester Zari and Coloured Zari.

`assets/images/metallic-zari-spools.webp` and `assets/images/metallic-filaments.webp` are existing temporary visuals. **TEMPORARY ASSET — REPLACE WITH OFFICIAL SUVARNATANTU PRODUCT PHOTOGRAPHY.**

## Backend hand-off

The current site has no secure server-side RFQ endpoint. Phase 1 therefore validates and prepares a prefilled email / WhatsApp hand-off, but does not pretend to store enquiries or issue reference numbers. Before production RFQ tracking, connect the form submission to a secure backend/CRM endpoint and generate references server-side. Do not put API keys in browser JavaScript.
