---
name: Modelo AMX anexado
description: Formato e decisão de preservação do primeiro modelo de aeronave fornecido pelo usuário.
---

O primeiro pacote de aeronave fornecido pelo usuário contém modelos nativos do Microsoft Flight Simulator em `.mdl`, acompanhados por texturas e arquivos de configuração do simulador. Esse formato não é carregado diretamente pelo navegador com Three.js; a versão web deve usar uma conversão controlada para `.glb`/`.gltf` em uma etapa separada.

**Why:** converter ou descartar o pacote original durante a primeira entrega poderia perder fidelidade, texturas ou possibilidade de auditoria do conteúdo recebido.

**How to apply:** preserve sempre o `.mdl` original dentro da pasta da aeronave e gere o asset web convertido como um arquivo derivado, com metadados de origem e validação visual antes de trocar o visualizador técnico.