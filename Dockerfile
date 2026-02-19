FROM nginx:alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy app files
COPY index.html /usr/share/nginx/html/
COPY style.css /usr/share/nginx/html/
COPY solver.js /usr/share/nginx/html/
COPY generator.js /usr/share/nginx/html/
COPY puzzle-bank.js /usr/share/nginx/html/
COPY app.js /usr/share/nginx/html/

EXPOSE 80
