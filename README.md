# Google Cardboard Viewer profile generator

## Deployment

Deployed using git to an EC2 box, running Docker.

Start with `docker compose up -d`.

To generate the initial certificate, use `docker-compose run --rm certbot certonly --webroot --webroot-path /var/www/html -d google-cardboard-profile-designer.ovrcome.io`

## Development

Run `npm run server` to run the server locally.
