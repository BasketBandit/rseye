$(document).ready(function() {
    var ping;
    var baseX = 1152, baseY = 2496;
    var clickX = 0, clickY = 0, transX = -3525, transY = -1350, deltaX = -3525, deltaY = -1350, zoom = 1.0; // weird offsets to center pre-zoomed canvas
    var canvasZoom = 1; // multiplier
    var canvasMinZoomRatio = 0.1;
    var canvasMaxZoomRatio = 4.0;
    var canvas = document.querySelector('canvas');
        canvas.width = 8256;
        canvas.height = 4800;
        canvas.style.width = canvas.width * canvasZoom;
        canvas.style.height = canvas.height * canvasZoom;
    var ctx = canvas.getContext('2d', {antialias: false});
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.font = '16px sans-serif';
    var canvasController = document.getElementById('canvas-controller');
    var canvasMouse = Array.from({length: 3}, i => i = false);
    $('#canvas-container').css({'width': '' + canvas.width * canvasZoom + 'px','height':'' + canvas.height * canvasZoom + 'px','transform': 'translate(' + deltaX + 'px,' + deltaY + 'px) scale(' + zoom + ')'});

    var map = new Image();
    map.onload = function() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(map, 0, 0);
    };
    map.src = "/img/map.webp";

    var playerPointer = new Image();
    playerPointer.src = "/img/map-pointer.webp"

    canvasController.addEventListener('mousedown', (e) => {
        if(e.button !== 0 && e.button !== 1 && e.button !== 2) { // middle click || right click
            return;
        }
        canvasMouse[e.button] = true;
        clickX = e.clientX; // store initial mouse location when translation begins
        clickY = e.clientY;
        transX = deltaX; // set origin of translation to final value of previous translation
        transY = deltaY;
    });

    canvasController.addEventListener('mouseup', (e) => {
        if(e.button !== 0 && e.button !== 1 && e.button !== 2) { // middle click || right click
            return;
        }
        canvasMouse[e.button] = false;
    });

    canvasController.addEventListener('mousemove', (e) => {
        if(canvasMouse[0] || canvasMouse[1] || canvasMouse[2]) {
            // deltaX|Y is final translation value, where transX|Y is initial value
            deltaX = transX + (e.clientX - clickX);
            deltaY = transY + (e.clientY - clickY);
            $('#canvas-container').css('transform', 'translate('+deltaX+'px,'+deltaY+'px) scale('+zoom+')');
        }
    });

    canvasController.addEventListener('wheel', (e) => {
        e.preventDefault();
        if(e.deltaY !== 0) {
            //var delta = (e.deltaY < 0) ? 0.1 : -0.1;
            //var temp = zoom + delta;
            //temp = (temp < canvasMinZoomRatio) ? canvasMinZoomRatio : temp > canvasMaxZoomRatio ? canvasMaxZoomRatio : temp; // minimum 0.1, maximum 4
            //zoom = Math.round(temp * 10) / 10; // deal with strange non-precise math
            //$('#canvas-container').css('transform', 'translate('+deltaX+'px,'+deltaY+'px) scale('+zoom+')');
        }
    });

    function connect() {
        ws = new WebSocket('wss://' + location.host + ':' + location.port + '/map/events');

        ws.onopen = function(event) {
            ping = setInterval(function(){ send("ping"); }, 30000); // ping the server every 30 seconds to keep the connection alive
            $(".player-data").empty(); // newZoom solution to disconnects (might flicker !BAD!)
            send("fetchLatestData");
        };

        ws.onerror = function(event) {
            ws.close();
        };

        ws.onclose = function(event) {
            clearInterval(ping); // clear the ping interval to stop pinging the server after it has closed
            connect();
        };

        ws.onmessage = function(event) {
            const data = event.data;

            if(data.startsWith("fetchLatestData:")) {
                const json = data.substring("fetchLatestData:".length, data.length);
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(map, 0, 0);
                $.each(JSON.parse(json), function(username, player) {
                    var x = (Number(player.position.x)-baseX)*3;
                    var y = canvas.height - ((Number(player.position.y)-baseY)*3);
                    ctx.drawImage(playerPointer, x, y);
                    ctx.fillStyle = "#ffffff";
                    ctx.fillText(player.username + "(level-" + player.combatLevel + ")", x + 16, y + 60);
                    $.get("/player/"+player.username, function(data) {
                        $(".player-data").append(data);
                    });
                });
                return;
            }

            if(data.startsWith("broadcastPlayerLocations:")) {
                const json = data.substring("broadcastPlayerLocations:".length, data.length);
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(map, 0, 0);
                $.each(JSON.parse(json), function(username, player) {
                    var x = (Number(player.position.x)-baseX)*3;
                    var y = canvas.height - ((Number(player.position.y)-baseY)*3);
                    ctx.drawImage(playerPointer, x, y);
                    ctx.fillStyle = "#ffffff";
                    ctx.fillText(player.username + "(level-" + player.combatLevel + ")", x + 16, y + 60);
                });
                return;
            }

            if(data.startsWith("new_player:")) {
                const json = data.substring("new_player:".length, data.length);
                const player = JSON.parse(json);
                $.get("/player/"+player.username, function(data) {
                    $(".player-data").append(data);
                });
                return;
            }

            if(data.startsWith("login_state")) {
                const json = data.substring("login_state:".length, data.length);
                const player = JSON.parse(json);
                $.get("/api/v1/player/"+player.username+"/login_state", function(data) {
                    const badge = $("#"+player.username.split(" ").join("-")).find(".badge");
                    (data == "LOGGED_IN") ? badge.removeClass("badge-danger").addClass("badge-success").text("Online") : badge.removeClass("badge-success").addClass("badge-danger").text("Offline")
                });
                return;
            }

            if(data.startsWith("npc_kill")) {
                $.get("/combat/latest", function(data) {
                    $(".update-feed").prepend(data);
                });
                if($('.feed-item').length > 9) {
                    $('.update-feed').find(".feed-item:last").remove();
                }
                return;
            }

            if(data.startsWith("level_change:")) {
                $.get("/growth/latest", function(data) {
                    $(".update-feed").prepend(data);
                });
                if($('.feed-item').length > 9) {
                    $('.update-feed').find(".feed-item:last").remove();
                }
                return;
            }

            if(data.startsWith("inventory_items:")) {
                const json = data.substring("inventory_items:".length, data.length);
                const player = JSON.parse(json);
                $.get("/player/"+player.username+"/inventory", function(data) {
                    $("#"+player.username.split(" ").join("-")).find(".inventory-container").replaceWith(data);
                });
                return;
            }

            if(data.startsWith("bank:")) {
                const json = data.substring("bank:".length, data.length);
                const player = JSON.parse(json);
                $.get("/player/"+player.username+"/bank", function(data) {
                    $("#"+player.username.split(" ").join("-")).find(".bank-container").replaceWith(data);
                });
                return;
            }

            if(data.startsWith("level_data:")) {
                const json = data.substring("level_data:".length, data.length);
                const player = JSON.parse(json);
                $.get("/player/"+player.username+"/stats", function(data) {
                    $("#"+player.username.split(" ").join("-")).find(".stats-container").replaceWith(data);
                });
                return;
            }

            if(data.startsWith("quest_change:")) {
                const json = data.substring("quest_change:".length, data.length);
                const player = JSON.parse(json);
                $.get("/player/"+player.username+"/quests", function(data) {
                    $("#"+player.username.split(" ").join("-")).find(".quests-container").replaceWith(data);
                });
                return;
            }

            if(data.startsWith("equipped_items:")) {
                const json = data.substring("equipped_items:".length, data.length);
                const player = JSON.parse(json);
                $.get("/player/"+player.username+"/equipment", function(data) {
                    $("#"+player.username.split(" ").join("-")).find(".equipment-container").replaceWith(data);
                });
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

    connect();
})