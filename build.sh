tsc src/index.ts --outDir src/
tsc --project tsconfig.web.json

# so replace this line: import { naem } from "./script"; 
# with this line: import { naem } from "./script.js";
#node build.mjs