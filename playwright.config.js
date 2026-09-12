import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests/browser',timeout:60000,use:{baseURL:'http://127.0.0.1:5174',viewport:{width:1440,height:1000},launchOptions:{channel:'msedge'},screenshot:'only-on-failure'},webServer:{command:'npm run dev -- --port 5174 --strictPort',url:'http://127.0.0.1:5174',reuseExistingServer:true}});
