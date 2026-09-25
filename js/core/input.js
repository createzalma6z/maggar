/* MAGGAR.io — klavye, fare ve dokunmatik kontroller */
(function (MG) {
  'use strict';

  class Input {
    constructor(canvas, h) {
      this.cv = canvas;
      this.h = h;
      this.mx = window.innerWidth / 2;
      this.my = window.innerHeight / 2;
      this.active = false;
      this.touch = null;
      this.joyVec = { x: 0, y: 0 };
      this.isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
      this.bind();
    }

    bind() {
      const cv = this.cv;
      window.addEventListener('mousemove', e => { this.mx = e.clientX; this.my = e.clientY; });
      cv.addEventListener('mousedown', e => {
        this.h.any && this.h.any();
        if (!this.active) return;
        // orta tık: bölünme, sağ tık: kütle at (isteğe bağlı kısayollar)
        if (e.button === 1) { e.preventDefault(); this.h.split(); }
        if (e.button === 2) { e.preventDefault(); this.h.eject(true); }
      });
      cv.addEventListener('mouseup', e => { if (e.button === 2) this.h.eject(false); });
      cv.addEventListener('contextmenu', e => e.preventDefault());
      cv.addEventListener('wheel', e => {
        if (!this.active) return;
        e.preventDefault();
        this.h.zoom(e.deltaY > 0 ? -1 : 1);
      }, { passive: false });

      window.addEventListener('keydown', e => {
        const tag = (e.target && e.target.tagName) || '';
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
          if (e.key === 'Enter' && e.target.id === 'nick') this.h.enter && this.h.enter();
          return;
        }
        this.h.any && this.h.any();
        if (e.code === 'Escape') { this.h.escape(); e.preventDefault(); return; }
        if (e.code === 'Enter') { this.h.enter && this.h.enter(); return; }
        if (!this.active) return;
        switch (e.code) {
          case 'Space': e.preventDefault(); if (!e.repeat) this.h.split(); break;
          case 'KeyW': if (!e.repeat) this.h.eject(true); break;
          case 'KeyQ': if (!e.repeat) this.h.doubleSplit(); break;
          case 'KeyE': if (!e.repeat) this.h.quadSplit(); break;
          case 'KeyF': case 'KeyR': if (!e.repeat) this.h.power(); break;
          case 'KeyM': if (!e.repeat) this.h.toggleMinimap(); break;
          case 'KeyT': if (!e.repeat) this.h.toggleChat && this.h.toggleChat(); break;
          case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4': case 'Digit5': case 'Digit6':
            if (!e.repeat) this.h.chat(parseInt(e.code.slice(5), 10) - 1);
            break;
          case 'Numpad1': case 'Numpad2': case 'Numpad3': case 'Numpad4': case 'Numpad5': case 'Numpad6':
            if (!e.repeat) this.h.chat(parseInt(e.code.slice(6), 10) - 1);
            break;
        }
      });
      window.addEventListener('keyup', e => {
        if (e.code === 'KeyW') this.h.eject(false);
      });
      window.addEventListener('blur', () => this.h.eject(false));

      // Dokunmatik: sanal joystick (ekranın herhangi bir yerinden başlar)
      const joy = document.getElementById('joystick');
      const knob = document.getElementById('joystick-knob');
      cv.addEventListener('touchstart', e => {
        this.h.any && this.h.any();
        if (!this.active) return;
        const t = e.changedTouches[0];
        if (this.touch) return;
        this.touch = { id: t.identifier, x: t.clientX, y: t.clientY };
        if (joy) {
          joy.style.display = 'block';
          joy.style.left = t.clientX + 'px';
          joy.style.top = t.clientY + 'px';
          knob.style.transform = 'translate(-50%,-50%)';
        }
        e.preventDefault();
      }, { passive: false });
      cv.addEventListener('touchmove', e => {
        if (!this.touch) return;
        for (const t of e.changedTouches) {
          if (t.identifier !== this.touch.id) continue;
          let dx = t.clientX - this.touch.x, dy = t.clientY - this.touch.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          const max = 60;
          if (d > max) { dx = dx / d * max; dy = dy / d * max; }
          this.joyVec.x = dx / max; this.joyVec.y = dy / max;
          if (knob) knob.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px))';
        }
        e.preventDefault();
      }, { passive: false });
      const end = e => {
        if (!this.touch) return;
        for (const t of e.changedTouches) {
          if (t.identifier === this.touch.id) {
            this.touch = null;
            if (joy) joy.style.display = 'none';
          }
        }
      };
      cv.addEventListener('touchend', end);
      cv.addEventListener('touchcancel', end);

      const btn = (id, down, up) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); this.h.any && this.h.any(); down(); }, { passive: false });
        if (up) el.addEventListener('touchend', e => { e.preventDefault(); up(); });
        el.addEventListener('click', e => { e.preventDefault(); if (!this.isTouch) { down(); if (up) setTimeout(up, 120); } });
      };
      btn('tb-split', () => this.h.split());
      btn('tb-eject', () => this.h.eject(true), () => this.h.eject(false));
      btn('tb-power', () => this.h.power());
      btn('tb-chat', () => this.h.toggleChat && this.h.toggleChat());
    }

    // Dünya üzerindeki hedef noktası (ekran merkezine göre)
    screenTarget() {
      if (this.isTouch && (this.touch || this.joyVec.x || this.joyVec.y)) {
        const W = window.innerWidth, H = window.innerHeight;
        const k = Math.min(W, H) * 0.45;
        return { x: W / 2 + this.joyVec.x * k, y: H / 2 + this.joyVec.y * k };
      }
      return { x: this.mx, y: this.my };
    }
  }

  MG.Input = Input;
})(window.MG = window.MG || {});
