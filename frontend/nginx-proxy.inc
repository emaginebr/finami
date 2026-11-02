# Cabeçalhos repassados à API (incluído pelos locations de proxy do nginx.conf).
# Mantém o host e o esquema que o proxy HTTPS do servidor recebeu (X-Forwarded-Proto/Host);
# sem proxy na frente, usa os valores desta conexão.
proxy_http_version 1.1;
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $finami_forwarded_proto;
proxy_set_header Connection "";
