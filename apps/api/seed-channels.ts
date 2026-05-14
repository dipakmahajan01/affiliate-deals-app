/**
 * Inserts/upserts all Telegram channels fetched from the account into MongoDB.
 * Usage: npx tsx seed-channels.ts
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { Channel } from './src/models/Channel';

const channels = [
  { channel_username: '-1001603407894', display_name: 'Love Babar- DSA & MERN', is_active: false },
  { channel_username: '-1001830835874', display_name: 'Love Babbar DSA Supreme', is_active: false },
  { channel_username: '-1001893028676', display_name: 'React with TypeScript', is_active: false },
  { channel_username: '-1001691760043', display_name: 'UI Full stack', is_active: false },
  { channel_username: 'DealsCouponsDiscounts', display_name: 'Amazon Deals, Coupons, and Discounts', is_active: true },
  { channel_username: 'FreeAmazonProductsUnitedStates', display_name: 'Free Amazon Products United States', is_active: false },
  { channel_username: '-1001695214148', display_name: 'Amazon Flipkart best loot deals', is_active: true },
  { channel_username: 'Freelanceroff', display_name: 'Freelancer | Freelance | Find Jobs & Projects', is_active: false },
  { channel_username: 'Bachat_Bazaarr', display_name: 'Bachat Bazaar', is_active: true },
  { channel_username: 'Alex_Deals', display_name: 'Alex Deals (Loot Deals & Offers)', is_active: true },
  { channel_username: 'iShop_Deal', display_name: 'iShop Deal (Regular Discount Posting)', is_active: true },
  { channel_username: 'HYBYDEAL3', display_name: 'HYBY DEAL 3.0', is_active: true },
  { channel_username: 'dealaddict', display_name: 'Deal Addict', is_active: true },
  { channel_username: 'DealDropHub', display_name: 'DealDrop Hub', is_active: true },
  { channel_username: '-1001930811005', display_name: 'My DigiMart', is_active: true },
  { channel_username: '-1002005746178', display_name: 'Click&Cart - Deals and Offers', is_active: true },
  { channel_username: '-1001849813716', display_name: 'Deals and Discounts', is_active: true },
  { channel_username: 'mydigimartfkshopsy', display_name: 'Fk & shpsy My Digimart', is_active: true },
  { channel_username: 'mydigimart', display_name: 'My Digimart 2.0', is_active: true },
  { channel_username: '-1001216719955', display_name: 'GymWallah - Gym Supplements & Whey Protein Offers & Deals', is_active: true },
  { channel_username: 'mydigimartdeals', display_name: 'My DigiMart Deals', is_active: true },
  { channel_username: '-1001132630588', display_name: 'Super Offer', is_active: true },
  { channel_username: '-1002616119812', display_name: 'Loots Xpert 2.0', is_active: true },
  { channel_username: 'digidlz', display_name: 'DigiDlz.in', is_active: true },
  { channel_username: 'dealsloots', display_name: 'Deals Loots', is_active: true },
  { channel_username: 'BeaversonTrade', display_name: 'Beaverson Trade', is_active: false },
  { channel_username: 'Alldeals4u', display_name: 'Deals', is_active: true },
  { channel_username: '-1002218492661', display_name: 'ZivaBuy India', is_active: true },
  { channel_username: 'shoppinglootly', display_name: 'Shopping lootly', is_active: true },
  { channel_username: '-1001803002117', display_name: 'Best Deals', is_active: true },
  { channel_username: 'durgasoftupdates', display_name: 'DURGASOFT UPDATES', is_active: false },
  { channel_username: 'English_IBPS_PO_Clerk_SSC_CGL_GK', display_name: 'English', is_active: false },
  { channel_username: '-1001397735543', display_name: 'Rohit Khattar - Cricket Tips', is_active: false },
  { channel_username: 'FreeAmazonProductUSA', display_name: 'Free Amazon Products USA', is_active: false },
  { channel_username: 'gujtrader', display_name: 'Gujrati_trader', is_active: false },
  { channel_username: '-1002141244402', display_name: 'Good Protein Offers - Supplements & Whey Protein', is_active: true },
  { channel_username: 'nareshit', display_name: 'Naresh IT', is_active: false },
  { channel_username: 'Stockforindia', display_name: 'Stocks Discussion group', is_active: false },
  { channel_username: 'AnirbanMarketDiary_NoPaidService', display_name: 'No Paid Service (Anirbban public channel)', is_active: false },
  { channel_username: '-1001927871327', display_name: 'Important Notifications', is_active: false },
  { channel_username: '-1001411319725', display_name: 'Trading Experts SEBI', is_active: false },
  { channel_username: 'hindibooks4u', display_name: '44Books.com - Best Hindi Books Site', is_active: false },
  { channel_username: 'reactjs_nodejs', display_name: 'ReactJS NodeJS Developers', is_active: false },
  { channel_username: 'learningsouls', display_name: 'Learning Souls - IT Courses', is_active: false },
  { channel_username: 'HYBYDEAL_BONUS', display_name: 'HYBY DEAL BONUS', is_active: true },
  { channel_username: 'AceinkOfficial', display_name: 'ACEink by EB Capital Services', is_active: false },
  { channel_username: 'rangmasti', display_name: 'Rangmasti FABRIZO', is_active: false },
  { channel_username: 'codeslearningnow', display_name: 'TheSanskaarSingh 2', is_active: false },
  { channel_username: 'Codingkitee', display_name: 'Codingkite', is_active: false },
  { channel_username: 'Career_desk01', display_name: 'Career desk', is_active: false },
  { channel_username: 'Aasanhai008', display_name: 'Aasan hai', is_active: false },
  { channel_username: 'freelanserwork', display_name: 'Freelancer work', is_active: false },
  { channel_username: 'freelancerAndClients', display_name: 'Freelancers and Clients', is_active: false },
  { channel_username: '-1003662655683', display_name: 'ACCESS-EARNERS.COM', is_active: false },
  { channel_username: 'backend_498', display_name: 'backenddev', is_active: false },
  { channel_username: 'catalinmpit', display_name: "Catalin's Friends", is_active: false },
  { channel_username: '-1001567456198', display_name: 'All Courses World', is_active: false },
  { channel_username: '-1002079766030', display_name: 'Amazon Reviews USA', is_active: false },
  { channel_username: 'HYBYDEAL2', display_name: 'HYBY DEAL 2.0', is_active: true },
  { channel_username: 'iShop_Deals', display_name: 'iShop Deal (Very Cheap Offer/Limited Time Post)', is_active: true },
  { channel_username: 'iShop_Business', display_name: 'iShop Business', is_active: false },
  { channel_username: 'rochitsinghtelegram', display_name: 'Rochit Singh Telegram', is_active: false },
  { channel_username: 'nugenprogrammer', display_name: "Nugen Programmer's", is_active: false },
  { channel_username: 'HYBYDEAL', display_name: 'HYBY DEAL', is_active: true },
  { channel_username: 'HYBYDEAL_TRICK', display_name: 'HYBY DEAL TRICK', is_active: true },
  { channel_username: 'HYBY_ONLINE_EARNING', display_name: 'HYBY ONLINE EARNING', is_active: false },
  { channel_username: 'HYBYDEAL_Extra', display_name: 'HYBY DEAL Extra', is_active: true },
  { channel_username: 'TheFinRate', display_name: 'TheFinRate - Rating Service Provider', is_active: false },
  { channel_username: '-1002052332595', display_name: 'Courses Group of LearningSoul', is_active: false },
  { channel_username: 'react_nodeJS_angular', display_name: 'Learn Node.js, React, Angular', is_active: false },
  { channel_username: '-1001816351324', display_name: 'D.K Computer and CCTV Camera Shop', is_active: false },
  { channel_username: 'zvdghtjtjytkjkftjtfj', display_name: 'Crypto Trading VIP 717', is_active: false },
  { channel_username: '-1001914846900', display_name: 'Angular learners', is_active: false },
  { channel_username: 'English_course_speaking', display_name: 'English Speaking Course', is_active: false },
];

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not set in .env');
    process.exit(1);
  }

  await mongoose.connect(uri);

  let inserted = 0, updated = 0, skipped = 0;

  for (const ch of channels) {
    const result = await Channel.updateOne(
      { channel_username: ch.channel_username },
      { $setOnInsert: ch },
      { upsert: true }
    );
    if (result.upsertedCount > 0) inserted++;
    else if (result.matchedCount > 0) { skipped++; }
    else updated++;
  }

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
