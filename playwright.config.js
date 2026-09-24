import {defineConfig} from '@playwright/test';
// The tests get their own dev server on 5175 in e2e mode (.env.e2e blanks the cloud settings), so a
// dev server you play on at 5174 with your real .env.local never leaks into them.
export default defineConfig({testDir:'./tests/browser',timeout:60000,use:{baseURL:'http://127.0.0.1:5175',viewport:{width:1440,height:1000},launchOptions:{channel:'msedge'},screenshot:'only-on-failure'},webServer:{command:'npm run dev -- --port 5175 --strictPort --mode e2e',url:'http://127.0.0.1:5175',reuseExistingServer:true}});
