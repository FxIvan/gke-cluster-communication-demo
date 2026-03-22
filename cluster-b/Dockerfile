FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx tsc
RUN cp module/products/products.db.json dist/module/products/
EXPOSE 3001
CMD ["node", "dist/src/main.js"]