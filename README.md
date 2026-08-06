# asun-dashboard

Dashboard de Ads do Grupo Asun (marcas Asun + Leve Mais) — Meta Ads, Google Ads, Instagram e Facebook orgânico. 100% estático, servido via GitHub Pages.

Sem backend: os dados em `data/asun.json` e `data/leve_mais.json` são publicados 1x/dia pelo GitHub Action do repo privado [`asun-dashboard-sync`](https://github.com/LuizVaccaro/asun-dashboard-sync), que busca as APIs das plataformas, normaliza e consolida.

## Estrutura

```
index.html
styles.css
js/
  data.js        # fetch de data/<brand>.json, cache em memória
  aggregate.js    # replica as agregações que antes eram SQL, agora no browser
  utils.js        # datas, formatação, tabelas ordenáveis, modal de criativo, gráficos
  app.js          # estado global (S), filtros, troca de aba/marca
  tabs/
    diario.js      # Desempenho Diário (soma as plataformas)
    google.js       # Google Ads
    meta.js         # Meta Ads (Campanhas / Criativos)
    organico.js      # Orgânico (Instagram / Facebook)
data/
  asun.json        # gerado pelo Action — NÃO editar manualmente
  leve_mais.json    # idem
```

## Fase 2 (não implementada ainda)

Sem senha nem criptografia por decisão deliberada — a prioridade foi ter a estrutura funcional primeiro (sync automático + dashboard no ar). `data/*.json` fica publicamente acessível a quem tiver o link, sem proteção nenhuma. Senha compartilhada + criptografia client-side dos dados entram como próxima etapa.

## Origem

Migrado de um dashboard equivalente rodando em Netlify Functions + Netlify DB (Postgres) — a lógica de negócio (classificação de funil, atribuição de conversão do Meta Ads, gate `%venda%` pra Valor de Vendas/Ticket/ROAS) foi portada 1:1, só trocando SQL agregado no servidor por JS agregando no browser (ver `js/aggregate.js`).
