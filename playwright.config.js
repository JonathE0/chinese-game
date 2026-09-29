import {defineConfig} from '@playwright/test';
// The tests get their own dev server on 5175 in e2e mode (.env.e2e blanks the cloud settings), so a
// dev server you play on at 5174 with your real .env.local never leaks into them. PW_PORT moves it,
// so a second checkout (the development worktree) can keep its own test server.
const port=Number(process.env.PW_PORT||5175);
export default defineConfig({testDir:'./tests/browser',timeout:60000,use:{baseURL:`http://127.0.0.1:${port}`,viewport:{width:1440,height:1000},launchOptions:{channel:'msedge'},screenshot:'only-on-failure'},webServer:{command:`npm run dev -- --port ${port} --strictPort --mode e2e`,url:`http://127.0.0.1:${port}`,reuseExistingServer:true}});
