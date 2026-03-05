# 🚀 SM Payroll System - Complete Workflow Guide

Yeh guide aapko batayegi ki project ko apne system par **Start (Run)** kaise karna hai aur naye code changes ko live server par **Update (Deploy)** kaise karna hai.

---

## 💻 1. Project Ko Start Kaise Karein (Local Development)

Full-stack project hai, isliye **Backend** aur **Frontend** dono ko alag-alag start karna padta hai. VS Code mein 2 terminal open kar lijiye.

### A. Backend Start Karein (Terminal 1)
VS Code ke pehle terminal mein yeh commands chalaiye:
```bash
# 1. Backend folder mein jayein
cd server

# 2. Dependencies install karein (Pehli baar ya naya package add hone par)
npm install

# 3. Backend server start karein
npm start
```
*✅ Yeh `http://localhost:3000` par run hona shuru ho jayega.*

### B. Frontend Start Karein (Terminal 2)
VS Code ke doosre terminal (root folder) mein yeh commands chalaiye:
```bash
# 1. Dependencies install karein (Pehli baar ya naya package add hone par)
npm install

# 2. React frontend start karein
npm run dev
```
*✅ Yeh `http://localhost:5173` par chalega. Is link par click karke browser mein app open karein.*

> **Dhyan dein:** Dono (Terminal 1 & 2) ek sath chalu rehne chahiye tabhi Frontend Backend se connect hoga (API chalegi).

---

## 🌍 2. Live Server Par Update Kaise Karein (Vercel & Render Auto-Deploy)

Aapka project **Vercel** (Frontend) aur **Render** (Backend) par hosted hai, aur yeh **GitHub** se fully automated hai. 

Jab bhi aap local PC par code mein kuch naya edit/update karte hain, toh live site par update karne ke liye sirf yeh **3 Git commands** chalane hain:

Root folder (`d:\Projects\SM PAYROLL SYSTEM`) wale terminal mein type karein:
```bash
# Step 1: Naye changes ko Git mein add karein
git add .

# Step 2: Changes ko ek title (message) ke sath save karein
git commit -m "update: koi naya feature dala ya issue fix kiya"

# Step 3: Naye code ko GitHub par push karein
git push
```

### ✅ Push karne ke baad kya hoga?
Jaise hi `git push` complete hoga, sab kuch khud ho jayega:
1. **GitHub** par aapka code update ho jayega.
2. **Vercel (Frontend)** automatically new UI changes ko deploy kar dega.
3. **Render (Backend)** automatically naye APIs ko deploy kar dega.
4. **1 se 3 minute** lagte hain dono ko deploy hone mein. Uske baad aap seedha live site check kar sakte hain: `https://sm-payroll-system.vercel.app/`

---

## ⚠️ Important Notes
- **Render Cold Start (Free Tier):** Backend free plan par hai. Agar 15 minute tak API use na ho, toh server "sleep" ho jata hai. Is wajah se site kholne par **pehla login attempt ya data load hone mein 50+ seconds lag sakte hain**. Baki uske baad website super fast ho jayegi.
- Agar koi environment variable `.env` file mein add karte hain, toh live server pe bhi Vercel/Render ke dashboard settings mein jakar unhe manually add karna padega.
