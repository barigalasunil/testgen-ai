{
  "use": {
    "playwright": "^1.14.2",
    "ts-node": "^9.0.0",
 
    "scripts": {
      "test:e2e": "playwright test"
    },
    
  "references": [
    "@types/jest",
    "@babel/preset-env",
    "@babel/polyfill",
    "@playwright/test/blueprint#typechecker@latest"
  ],
  
  "dependencies": {
    "@babel/cli": "^7.14.5",
    "@babel/core": "^7.0.0-edge.0",
    "@babel/node": "^7.0.0-rc.2",
    "@playwright/test": "^1.14.3"
  },
  
  "devDependencies": {
    "@types/jest": "^26.0.3",
    "ts-jest": "^26.0.2",
    "typescript": "^4.5.4"
  },
  
  "scripts": {
    "test:e2e": "playwright test src/page_objects/*.ts --reporter=json -o reports/report.json",
    "build:css": "autoprefixer ./src/scss/**"
  },
  
  "jest": {
    "preset": "@playwright/test/_integ-tests/"
  }
}