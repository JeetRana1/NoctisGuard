# Dockerfile for the dashboard service
FROM node:18-alpine
WORKDIR /usr/src/app

COPY NoctisGuardWebTest/package*.json ./
RUN npm install --production

# Copy dashboard source
COPY NoctisGuardWebTest/ .

ENV PORT=3000
EXPOSE 3000

# Use the same start script the dashboard expects
CMD ["npm", "run", "start"]
