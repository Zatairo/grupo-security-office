"""
discord_bot/bot.py

Entrada principal del bot Discord.
Conecta el DIRECTOR con los canales y comandos slash.

Uso:
    python -m discord_bot.bot
  o bien:
    python main.py
"""
import asyncio
import logging
import os
import sys

import discord
from discord.ext import commands
from rich.logging import RichHandler

from config.settings import settings
from memory.store import MemoryStore
from agents.director import DirectorAgent

# ---------------------------------------------------------------- Logging
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(message)s",
    handlers=[
        RichHandler(rich_tracebacks=True),
        logging.FileHandler(settings.log_file, encoding="utf-8"),
    ],
)
log = logging.getLogger("bot")

# ---------------------------------------------------------------- Discord
intents = discord.Intents.default()
intents.message_content = True
intents.guilds = True

bot = commands.Bot(
    command_prefix="/",
    intents=intents,
    description="Oficina Multiagente Grupo Security",
)

# Estado global del bot
memory: MemoryStore = None
director: DirectorAgent = None


@bot.event
async def on_ready():
    global memory, director
    log.info("[bot] Conectado como %s (ID: %s)", bot.user, bot.user.id)

    # Inicializar memoria
    os.makedirs("data", exist_ok=True)
    memory = MemoryStore(settings.memory_db_path)
    await memory.init()

    # Inicializar DIRECTOR
    director = DirectorAgent(memory)

    # Guardar contexto de arranque
    await memory.set_context(
        "DIRECTOR", "bot_status",
        {"status": "online", "guild": settings.discord_guild_id},
    )

    # Sincronizar comandos slash
    try:
        synced = await bot.tree.sync(guild=discord.Object(id=int(settings.discord_guild_id)))
        log.info("[bot] %d comandos slash sincronizados", len(synced))
    except Exception as e:
        log.error("[bot] Error sincronizando comandos: %s", e)

    log.info("[bot] DIRECTOR online. Oficina Grupo Security operativa.")


# ---------------------------------------------------------------- Slash commands

@bot.tree.command(
    name="tarea",
    description="Envía una solicitud al DIRECTOR para crear y despachar una tarea",
    guild=discord.Object(id=int(settings.discord_guild_id)) if settings.discord_guild_id else None,
)
async def cmd_tarea(interaction: discord.Interaction, descripcion: str):
    await interaction.response.defer(thinking=True)
    response = await director.handle(
        user_input=descripcion,
        discord_user=str(interaction.user),
        channel_id=str(interaction.channel_id),
        thread_id=str(interaction.channel_id) if isinstance(interaction.channel, discord.Thread) else None,
    )
    embed_data = response.to_discord_embed()
    embed = discord.Embed(
        title=embed_data["title"],
        description=embed_data["description"],
        color=discord.Color.blue() if response.priority == "medium" else
              discord.Color.red() if response.priority == "high" else
              discord.Color.green(),
    )
    for field in embed_data["fields"]:
        embed.add_field(name=field["name"], value=field["value"], inline=field["inline"])
    embed.set_footer(text=f"Task ID: {response.task_id} | ZDR: {'✅' if settings.zdr_enabled else '⚠️'}")
    await interaction.followup.send(embed=embed)


@bot.tree.command(
    name="estado",
    description="Muestra el estado actual de la oficina (tareas, handoffs, decisiones)",
    guild=discord.Object(id=int(settings.discord_guild_id)) if settings.discord_guild_id else None,
)
async def cmd_estado(interaction: discord.Interaction):
    await interaction.response.defer(thinking=True)
    report = await director.get_status_report()
    await interaction.followup.send(report)


@bot.tree.command(
    name="tarea_status",
    description="Consulta el estado de una tarea específica por ID",
    guild=discord.Object(id=int(settings.discord_guild_id)) if settings.discord_guild_id else None,
)
async def cmd_tarea_status(interaction: discord.Interaction, task_id: str):
    await interaction.response.defer(thinking=True)
    task = await memory.get_task(task_id.upper())
    if not task:
        await interaction.followup.send(f"❌ Tarea `{task_id}` no encontrada.")
        return
    lines = [
        f"**📋 Tarea `{task['id']}`**",
        f"**Título:** {task['title']}",
        f"**Estado:** {task['status']}",
        f"**Agente:** {task.get('agent') or '—'}",
        f"**Prioridad:** {task.get('priority') or '—'}",
        f"**Creada:** {task['created_at'][:19]}Z",
    ]
    await interaction.followup.send("\n".join(lines))


@bot.tree.command(
    name="decidir",
    description="Registra manualmente una decisión aprobada por el equipo",
    guild=discord.Object(id=int(settings.discord_guild_id)) if settings.discord_guild_id else None,
)
async def cmd_decidir(interaction: discord.Interaction, titulo: str, descripcion: str):
    await interaction.response.defer(thinking=True)
    dec_id = await memory.save_decision(
        title=titulo,
        description=descripcion,
        agent="HUMAN",
        rationale="Decisión manual registrada desde Discord",
    )
    await interaction.followup.send(
        f"✅ Decisión `{dec_id}` archivada: **{titulo}**\n_{descripcion}_"
    )


# ---------------------------------------------------------------- on_message (canal principal)

@bot.event
async def on_message(message: discord.Message):
    """Permite activar el DIRECTOR con @bot en el canal de operaciones."""
    if message.author.bot:
        return
    if bot.user in message.mentions:
        response = await director.handle(
            user_input=message.clean_content.replace(f"@{bot.user.display_name}", "").strip(),
            discord_user=str(message.author),
            channel_id=str(message.channel.id),
            thread_id=str(message.channel.id) if isinstance(message.channel, discord.Thread) else None,
        )
        await message.reply(response.message[:2000])  # Límite Discord
    await bot.process_commands(message)


# ---------------------------------------------------------------- Entry point

def main():
    os.makedirs("data/context", exist_ok=True)
    bot.run(settings.discord_bot_token, log_handler=None)  # log ya configurado arriba


if __name__ == "__main__":
    main()
