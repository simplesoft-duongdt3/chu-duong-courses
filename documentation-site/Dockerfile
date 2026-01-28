# Use the lightweight Nginx Alpine image
FROM nginx:alpine

# Copy the static website files to the Nginx html directory
COPY ./public /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
