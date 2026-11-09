# Smart Salon LK - Design System & UI/UX Specifications

**Google Stitch Project ID:** `1893358823343289545`  
**Application Name:** Smart Salon LK (ස්මාර්ට් සැලූන්)  
**Location:** No. 42, Kandy Road, Kiribathgoda (Opposite Keells Super, Landmark Junction)

---

## 1. Brand & Style Philosophy

This design system embodies the ritual, heritage, and modern efficiency of the contemporary Sri Lankan men's salon culture. It bridges two distinct user groups:
1. **On-the-go clients** tracking active waitlists on mid-tier smartphones in bright outdoor sunlight.
2. **Busy salon operators** managing appointments with clippers in one hand and mobile POS screens in the other.

### The Design Movement: Modern Tactical Utility + Classic Barbershop Craft
- **Tone:** Authoritative, hospitable, prompt, and grounded. Replaces cluttered spreadsheet booking software with tactile, high-contrast, purpose-driven touchpoints.
- **Visual Personality:**
  - **Deep coastal midnight navy (`#001428`, `#0F2942`):** Conveys stability, executive grooming, and prestige.
  - **Warm vintage amber / antique brass (`#904D00`, `#FE932C`):** Evokes brass shears, warm ambient lighting, and traditional hair tonic bottles.
  - **Crisp emerald green (`#002E1D`, `#21A173`, `#85F8C4`):** Signals LankaQR digital settlements, verified WhatsApp triggers, and the pulsing "Now Serving / Chair Ready" live queue updates.
- **Ergonomics:** Designed for high-stress, moisture-prone, single-thumb usage with minimum 48×48px tap targets.

---

## 2. Color Palette & Functional Roles

| Token | Hex Value | Role & Usage |
|---|---|---|
| `primary` | `#001428` | Main dark text, primary CTA text, QR code matrix |
| `primary-container` | `#0F2942` | Hero background cards, primary operational buttons, dark surfaces |
| `on-primary` | `#FFFFFF` | Text on primary containers |
| `on-primary-container`| `#7991AF` | Secondary text on dark cards |
| `secondary` | `#904D00` | Barbershop amber, rating stars, price highlights |
| `secondary-container`| `#FE932C` | Active ticket highlight badge, VIP badges, warm buttons |
| `on-secondary` | `#FFFFFF` | Text on secondary buttons |
| `tertiary-container` | `#002E1D` | Emerald green container for WhatsApp triggers, LankaQR badges |
| `tertiary-fixed` | `#85F8C4` | High-visibility emerald text on dark containers |
| `on-tertiary-container`| `#21A173`| Live queue pulsing radar, checkmarks, live indicators |
| `surface` | `#F9F9FF` | Base light slate canvas, anti-glare under tropical sunlight |
| `surface-container-lowest`| `#FFFFFF` | Primary elevated white cards |
| `surface-container-low`| `#F0F3FF` | Secondary card fills and input backgrounds |
| `surface-container-high`| `#DEE8FF` | Badge backgrounds, tab pills |
| `on-surface` | `#121C2C` | High-contrast body and header text |
| `on-surface-variant`| `#43474D` | Subtitles, duration labels, location text |

---

## 3. Typography Scale

- **Headline XL / Mobile:** Plus Jakarta Sans • 40px / 30px • Weight 800 • Line Height 48px / 36px
- **Headline LG / Mobile:** Plus Jakarta Sans • 32px / 24px • Weight 700 • Line Height 40px / 32px
- **Headline MD:** Plus Jakarta Sans • 20px • Weight 700 • Line Height 28px
- **Title LG:** Plus Jakarta Sans • 18px • Weight 600 • Line Height 26px
- **Title MD:** Inter • 16px • Weight 600 • Line Height 24px
- **Body LG:** Inter • 16px • Weight 400 • Line Height 24px
- **Body MD:** Inter • 14px • Weight 400 • Line Height 20px
- **Label LG / MD / SM:** Inter • 14px / 12px / 11px • Weights 600 / 500
- **Token Number:** Plus Jakarta Sans • 56px • Weight 800 (Readable from 3 meters on salon counter tablets)
- **Currency Display (LKR):** Plus Jakarta Sans • 26px • Weight 800 (Prevents alignment jitter during live cash calculation)

---

## 4. Screens Imported from Stitch (Project `1893358823343289545`)

1. **Smart Salon LK - Home & Services** (`Screen 19182a9c04dd4f64a7c08e2e42e452fd`):
   - Hero showcase card with ambient salon photography and live queue wait time
   - WhatsApp direct chat banner (`+94 77 123 4567`)
   - Category filter tabs: All Services (සියලුම), Haircuts (කොණ්ඩය), Beard & Shave, Treatments & Massage
   - Service cards (Adult Hair Cut, Hair Cut + Beard Grooming, Child Hair Cut, Classic Beard Trim, Herbal Head Massage, Hair Color)
   - Stylists on duty today (Kasun P., Nuwan R., Dhammika)
   - Branch details with LankaQR & parking badges
   - Interactive slide-up booking & instant walk-in token drawer

2. **Smart Salon LK - Book Appointment** (`Screen 8d5a6e01399d496194408cbc84912700`):
   - 3-step progress stepper
   - Stylist selection cards with ratings and live availability (Master Kavi, Sunil Shantha, Any Available Express)
   - Horizontal date picker (Today 24, Fri 25, Sat 26, Sun 27) with Sinhala & English labels
   - Morning, Afternoon, Evening time slot selector with Live Chair Sync
   - Customer details input with Sri Lankan +94 WhatsApp verification
   - Sticky bottom booking action bar with live price tally (LKR 1,800.00)

3. **Smart Salon LK - Live Queue Tracker** (`Screen 4950cbc16e9c4094bee5bf27e9084804`):
   - Real-time "LIVE QUEUE ACTIVE" status banner
   - "Now Serving" hero card (Token #07 in Chair 1, Master Kavi)
   - "Your Ticket" spotlight card (YOUR TICKET: #10, 3 people ahead, ⏱ 22m wait, 10:15 AM call time)
   - Stepper pipeline progress bar (#07 Active -> #08 Chair 2 -> #09 Prep -> #10 YOU)
   - Tactile actions: "Running Late (+10m)" with toast notification, and ticket cancel prompt
   - SMS & WhatsApp notification toggle
   - Chairs on salon floor live tracker (Chair 1, Chair 2, Chair 3)
   - Dynamic Entry QR code modal with SVG matrix for check-in scanner

4. **Smart Salon LK - Salon Owner POS & Queue Manager** (`Screen e55f20211f29423fa37b404661fb95e2`):
   - Salon Open / Closed operational status toggle
   - 4-Stat revenue & queue dashboard (Revenue LKR 28,400, Served 24 heads, In Queue 4 guests, Appts Left 6 slots)
   - Live Operator Console for Chair 01 with thumb-friendly "✓ Complete & Bill", "Call Next (#08)", and "Skip / Absent"
   - Quick Add Walk-In strip with instant service presets (+Haircut, +Beard Shape, +Head Massage)
   - LankaQR & Cash Quick Billing Terminal with dynamic SVG matrix, bank app scan guide (FriMi, Flash, Genie, Commercial Bank), and WhatsApp digital receipt dispatcher
   - End-of-Day cash drawer reconciliation with physical cash and LankaQR settlement totals, plus Shift Z-Report generator

---

## 5. Next.js App Routes

- `/` : Full interactive single-page app with bottom navigation switching
- `/book` : Direct route to Book Appointment flow
- `/live-queue` : Direct route to Live Queue Tracker
- `/owner-pos` : Direct route to Salon Owner POS & Queue Manager
- `/bookings` : Direct route to My Bookings and history

