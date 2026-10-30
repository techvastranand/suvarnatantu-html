import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {structuredDataPlan} from './structured-data.mjs';

const root=resolve(import.meta.dirname,'..');
let changed=0;
const plan=await structuredDataPlan(root);
for(const page of plan)if(page.expected!==page.html){await writeFile(resolve(root,page.source),page.expected);changed++;}
console.log(`Refreshed build-time JSON-LD in ${changed} of ${plan.length} sitemap pages.`);
