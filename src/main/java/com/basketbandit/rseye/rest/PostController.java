package com.basketbandit.rseye.rest;

import com.basketbandit.rseye.Application;
import com.basketbandit.rseye.AssetManager;
import com.basketbandit.rseye.Utils;
import com.basketbandit.rseye.entity.Item;
import com.basketbandit.rseye.entity.Monster;
import com.basketbandit.rseye.entity.Player;
import com.basketbandit.rseye.entity.event.CombatEvent;
import com.basketbandit.rseye.entity.event.GrowthEvent;
import com.basketbandit.rseye.entity.event.QuestEvent;
import com.basketbandit.rseye.entity.fragment.*;
import com.basketbandit.rseye.socket.MapSocketHandler;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.Set;

@RestController
public class PostController {
    @PostMapping("/api/v1/login_update/")
    public void loginUpdate(@RequestAttribute("player") Player player, @RequestAttribute("object") JsonObject data) {
        player.setLoginState(data.get("state").getAsString());
        MapSocketHandler.broadcastUpdate(UpdateType.LOGIN_UPDATE, player);
    }

    @PostMapping("/api/v1/position_update/")
    public void positionUpdate(@RequestAttribute("player") Player player, @RequestAttribute("object") JsonObject data) {
        JsonObject p = data.get("position").getAsJsonObject();
        HashMap<String, String> position = new HashMap<>() {{
            put("x", p.get("x").getAsString());
            put("y", p.get("y").getAsString());
            put("plane", p.get("plane").getAsString());
        }};

        player.setInformation(new PlayerInformation(player.information().username(), player.information().usernameEncoded(), player.information().combatLevel(), position));
        MapSocketHandler.broadcastUpdate(UpdateType.POSITION_UPDATE, player);
    }

    @PostMapping("/api/v1/stat_update/")
    public void statUpdate(@RequestAttribute("player") Player player, @RequestAttribute("object") JsonObject data) {
        HashMap<String, HashMap<String, Integer>> skills = player.stats().stats();
        data.get("statChanges").getAsJsonArray().forEach(s -> {
            JsonObject statUpdate = s.getAsJsonObject();
            String skill = statUpdate.get("skill").getAsString();
            HashMap<String, Integer> statCurrent = skills.get(skill);

            // determine if the player has leveled-up a stat
            if(statCurrent.get("level") != 0 && statCurrent.get("level") < statUpdate.get("level").getAsInt()) {
                Application.growthFeed.add(new GrowthEvent(player.information().username(), Utils.toPascal(statUpdate.get("skill").getAsString()), statUpdate.get("level").getAsString()));
                MapSocketHandler.broadcastUpdate(UpdateType.STAT_UPDATE, player);
            }

            // determine if the players current prayer or hitpoints have changed
            if((skill.equals("HITPOINTS") || skill.equals("PRAYER")) && statCurrent.get("boostedLevel") != statUpdate.get("boostedLevel").getAsInt()) {
                MapSocketHandler.broadcastUpdate(UpdateType.STATUS_UPDATE, player);
            }

            skills.put(statUpdate.get("skill").getAsString(), new HashMap<>(){{
                put("level", statUpdate.get("level").getAsInt());
                put("xp", statUpdate.get("xp").getAsInt());
                put("boostedLevel", statUpdate.get("boostedLevel").getAsInt());
            }});
        });

        int totalLevel = 0;
        for(HashMap<String, Integer> skill: skills.values()) {
            totalLevel += skill.get("level");
        }

        player.setInformation(new PlayerInformation(player.information().username(), player.information().usernameEncoded(), data.get("combatLevel").getAsString(), player.information().position()));
        player.setStats(new PlayerStats(totalLevel, skills));

        MapSocketHandler.broadcastUpdate(UpdateType.STAT_DATA, player);
    }

    @PostMapping("/api/v1/bank_update/")
    public void bankUpdate(@RequestAttribute("player") Player player, @RequestAttribute("object") JsonObject data) {
        Integer value = 0;
        JsonArray inventoryArray = data.get("items").getAsJsonArray();
        ArrayList<Item> bank = new ArrayList<>();
        inventoryArray.forEach(i -> {
            JsonObject o = i.getAsJsonObject();
            Item item = new Item(AssetManager.items.getOrDefault(o.get("id").getAsString(), AssetManager.items.get("0")));
            item.quantity = item.isPlaceholder ? 0 : o.get("quantity").getAsInt();
            item.quantityFormatted = item.isPlaceholder ? "0" : Utils.formatNumber(o.get("quantity").getAsInt());
            if(!item.equals(AssetManager.items.get("0"))) {
                bank.add(item);
            }
        });
        player.setBank(new PlayerBank(value, bank));

        MapSocketHandler.broadcastUpdate(UpdateType.BANK_UPDATE, player);
    }

    @PostMapping("/api/v1/equipment_update/")
    public void equipmentUpdate(@RequestAttribute("player") Player player, @RequestAttribute("object") JsonObject data) {
        JsonObject equippedItemObject = data.get("items").getAsJsonObject();
        Set<String> equippedItemKeySet = equippedItemObject.keySet();
        HashMap<String, Item> equipped = new HashMap<>();
        equippedItemKeySet.forEach(slot -> {
            JsonObject obj = equippedItemObject.get(slot).getAsJsonObject();
            Item item = new Item(AssetManager.items.getOrDefault(obj.get("id").getAsString(), AssetManager.items.get("0")));
            item.quantity = obj.get("quantity").getAsInt();
            item.quantityFormatted = Utils.formatNumber(obj.get("quantity").getAsInt());
            equipped.put(slot, item);
        });
        player.setEquipment(new PlayerEquipment(equipped));

        MapSocketHandler.broadcastUpdate(UpdateType.EQUIPMENT_UPDATE, player);
    }

    @PostMapping("/api/v1/inventory_update/")
    public void inventoryUpdate(@RequestAttribute("player") Player player, @RequestAttribute("object") JsonObject data) {
        JsonArray inventoryArray = data.get("items").getAsJsonArray();
        ArrayList<Item> inventory = new ArrayList<>();
        inventoryArray.forEach(slot -> {
            JsonObject o = slot.getAsJsonObject();
            Item item = new Item(AssetManager.items.getOrDefault(o.get("id").getAsString(), AssetManager.items.get("0")));
            item.quantity = o.get("quantity").getAsInt();
            item.quantityFormatted = Utils.formatNumber(o.get("quantity").getAsInt());
            inventory.add(item);
        });
        player.setInventory(new PlayerInventory(inventory));

        MapSocketHandler.broadcastUpdate(UpdateType.INVENTORY_UPDATE, player);
    }

    @PostMapping("/api/v1/quest_update/")
    public void questUpdate(@RequestAttribute("player") Player player, @RequestAttribute("object") JsonObject data) {
        JsonArray questArray = data.get("questChanges").getAsJsonArray();
        if(questArray.size() < 3) {
            for(int i = 0; i < questArray.size(); i++) {
                JsonObject quest = questArray.get(i).getAsJsonObject();
                Application.questFeed.add(new QuestEvent(player.information().username(), quest.get("name").getAsString(), quest.get("state").getAsString()));
                MapSocketHandler.broadcastUpdate(UpdateType.QUEST_UPDATE, player);
            }
        }

        ArrayList<Quest> quests = new ArrayList<>();
        questArray.forEach(q -> {
            JsonObject quest = q.getAsJsonObject();
            quests.add(new Quest(quest.get("id").getAsInt(), quest.get("name").getAsString(), quest.get("state").getAsString()));
        });
        player.setQuests(new PlayerQuests(data.get("questPoints").getAsInt(), quests));

        MapSocketHandler.broadcastUpdate(UpdateType.QUEST_DATA, player);
    }

    @PostMapping("/api/v1/loot_update/")
    public void lootUpdate(@RequestAttribute("player") Player player, @RequestAttribute("object") JsonObject data) {
        JsonArray lootArray = data.get("items").getAsJsonArray();
        Item weapon = player.equipment().equipped().getOrDefault("WEAPON", null);
        Monster monster = AssetManager.monsters.get(data.get("npcId").getAsString());
        ArrayList<Item> loot = new ArrayList<>();
        lootArray.forEach(slot -> {
            JsonObject o = slot.getAsJsonObject();
            Item item = new Item(AssetManager.items.getOrDefault(o.get("id").getAsString(), AssetManager.items.get("0")));
            item.quantity = o.get("quantity").getAsInt();
            item.quantityFormatted = Utils.formatNumber(o.get("quantity").getAsInt());
            loot.add(item);
        });

        Application.combatFeed.add(new CombatEvent(player.information().username() + " (level-" + player.information().combatLevel() + ")", weapon, monster, loot));
        if(Application.combatFeed.size() > 100) {
            Application.combatFeed.remove(0);
        }

        MapSocketHandler.broadcastUpdate(UpdateType.LOOT_UPDATE, player);
    }
}
