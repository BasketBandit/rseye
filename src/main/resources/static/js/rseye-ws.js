function connect() {
    ws = new WebSocket('wss://' + location.host + ':' + location.port + '/map/events');

    ws.onopen = function(event) {
        send("fetch");
    };

    ws.onerror = function(event) {
        ws.close();
    };

    ws.onclose = function(event) {
        connect();
    };

    ws.onmessage = function(event) {
        const data = event.data;

        if(data == "ping") {
            send("pong");
            return;
        }

        if(data.startsWith("fetch:")) {
            // in case websocket connection is lost, clear old data
            $(".player-online").empty();
            $(".player-offline").empty();
            $(".map-player-online").empty();
            $(".map-player-offline").empty();
            $(".leaflet-marker-pane").empty(); // experimental

            // load each player
            $.each(JSON.parse(data.substring("fetch:".length, data.length)), function(username, player) {
                $.get("/player/"+player.username, function(data) {
                    $(data.includes("LOGGED_IN") ? ".player-online" : ".player-offline").append(data);
                    $("#map-status-"+player.usernameEncoded).detach().appendTo(data.includes("LOGGED_IN") ? ".map-player-online" : ".map-player-offline");
                    $('[data-toggle="tooltip"]').tooltip() // initialise tooltips
                    updatePosition(player);
                });
            });
            return;
        }

        if(data.startsWith("new_player:")) {
            const player = JSON.parse(data.substring("new_player:".length, data.length));
            $.get("/player/"+player.username, function(data) {
                $(data.includes("LOGGED_IN") ? ".player-online" : ".player-offline").append(data);
                $("#map-status-"+player.usernameEncoded).detach().appendTo(data.includes("LOGGED_IN") ? ".map-player-online" : ".map-player-offline");
                $("#"+player.usernameEncoded+"-position").detach().appendTo('#canvas-container');
            });
            return;
        }

        if(data.startsWith("login_update:")) {
            const player = JSON.parse(data.substring("login_update:".length, data.length));
            $.get("/api/v2/player/"+player.username+"/login_state", function(data) {
                const pn = $("#"+player.usernameEncoded);
                const map = $("#map-status-"+player.usernameEncoded);
                const badge = pn.find(".badge");
                const mapBadge = map.find(".badge");
                if((data == "LOGGED_IN" || data == "HOPPING") && badge.hasClass("badge-danger")) {
                    badge.removeClass("badge-danger").addClass("badge-success").text("Online");
                    pn.detach().appendTo(".player-online");
                    mapBadge.removeClass("badge-danger").addClass("badge-success").text("Online");
                    map.detach().appendTo(".map-player-online");
                    return;
                }
                badge.removeClass("badge-success").addClass("badge-danger").text("Offline");
                pn.detach().appendTo(".player-offline");
                mapBadge.removeClass("badge-success").addClass("badge-danger").text("Offline");
                map.detach().appendTo(".map-player-offline");
            });
            return;
        }

        if(data.startsWith("position_update:")) {
            const player = JSON.parse(data.substring("position_update:".length, data.length));
            updatePosition(player);
            return;
        }

        if(data.startsWith("combat_loot_update:")) {
            $.get("/combat/latest", function(data) {
                $(".update-feed").css({top:-150});
                $(".update-feed").prepend(data);
                $(".update-feed").animate({top: 5}, 1000);
                clearFeed();
            });
            $.get("/loot-tracker", function(data) {
                $("#global-loot-tracker").html(data);
            })
            return;
        }

        if(data.startsWith("raid_loot_update:")) {
            $.get("/raid/latest", function(data) {
                $(".update-feed").css({top:-150});
                $(".update-feed").prepend(data);
                $(".update-feed").animate({top: 5}, 1000);
                clearFeed();
            });
            return;
        }

        if(data.startsWith("stat_update:")) {
            $.get("/growth/latest", function(data) {
                $(".update-feed").prepend(data);
                clearFeed();
            });
            return;
        }

        if(data.startsWith("quest_update:")) {
            $.get("/quest/latest", function(data) {
                $(".update-feed").prepend(data);
                clearFeed();
            });
            return;
        }

        if(data.startsWith("exp_update")) {
            const player = JSON.parse(data.substring("exp_update:".length, data.length));

            var updateString = "";
            for(const [key, value] of Object.entries(player.data)) {
                updateString += "<img class='xp-drop-icon' src='/data/icons/skill/"+key+".png'/><span>"+value+"</span><br>";
            }

            var updateWorld = $("<span class='xp-drop'>" + updateString + "</span>");
            var updateMini = $("<span class='xp-drop'>" + updateString + "</span>");
            $("div[title='"+player.usernameEncoded+"-position']").append(updateWorld);
            $("div[title='"+player.usernameEncoded+"-minimap-position']").append(updateMini);
            updateWorld.css({top:(-15+-updateWorld.height())});
            updateWorld.animate({
                opacity: '0',
                top: -225+-updateWorld.height()
            }, 3000, function(){
              updateWorld.remove();
            });
            updateMini.css({top:(-15+-updateMini.height())});
            updateMini.animate({
                opacity: '0',
                top: -225+-updateMini.height()
            }, 3000, function(){
              updateMini.remove();
            });
            return;
        }

        if(data.startsWith("inventory_update:")) {
            const player = JSON.parse(data.substring("inventory_update:".length, data.length));
            $.get("/player/"+player.username+"/inventory", function(data) {
                updatePlayerContainer(".inventory-container", player, data);
            });
            return;
        }

        if(data.startsWith("bank_update:")) {
            const player = JSON.parse(data.substring("bank_update:".length, data.length));
            $.get("/player/"+player.username+"/bank", function(data) {
                updatePlayerContainer(".bank-container", player, data);
            });
            return;
        }

        if(data.startsWith("equipment_update:")) {
            const player = JSON.parse(data.substring("equipment_update:".length, data.length));
            $.get("/player/"+player.username+"/equipment", function(data) {
                updatePlayerContainer(".equipment-container", player, data);
            });
            return;
        }

        if(data.startsWith("status_update")) {
            // loads the player current hitpoints/prayer
            const player = JSON.parse(data.substring("status_update:".length, data.length));
            $.get("/player/"+player.username+"/status", function(data) {
                $("#map-status-"+player.usernameEncoded).find(".player-current-state").replaceWith(data);
            });
            return;
        }

        if(data.startsWith("stat_data:")) {
            const player = JSON.parse(data.substring("stat_data:".length, data.length));
            $.get("/player/"+player.username+"/stats", function(data) {
                updatePlayerContainer(".stats-container", player, data);
            });
            return;
        }

        if(data.startsWith("quest_data:")) {
            const player = JSON.parse(data.substring("quest_data:".length, data.length));
            $.get("/player/"+player.username+"/quests", function(data) {
                updatePlayerContainer(".quests-container", player, data);
            });
            return;
        }

        if(data.startsWith("overhead_update:")) {
            const player = JSON.parse(data.substring("overhead_update:".length, data.length));
            $("#map-status-"+player.usernameEncoded).find(".player-overheads").children().hide();
            $("#map-status-"+player.usernameEncoded).find("."+player.overhead).show();
            return;
        }

        if(data.startsWith("skull_update:")) {
            const player = JSON.parse(data.substring("skull_update:".length, data.length));
            $("#map-status-"+player.usernameEncoded).find(".player-skulls").children().hide();
            $("#map-status-"+player.usernameEncoded).find("."+player.skull).show();
            return;
        }
    };
}

function send(data) {
    if(ws.readyState == 0) {
        setTimeout(() => {
            send(data);
        }, 10);
        return;
    }
    if(ws.readyState == 1) {
        ws.send(data);
    }
}