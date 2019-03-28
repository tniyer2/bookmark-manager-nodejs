
(function(){

	this.styleOnFocus = function(target, elm, cl)
	{
		return new awesomeFocus(target, () => {
			if (!elm.classList.contains(cl))
			{
				elm.classList.add(cl);
			}
		}, () => {
			if (elm.classList.contains(cl))
			{
				elm.classList.remove(cl);
			}
		});
	}

	this.awesomeFocus = class{
		constructor(target, onfocus, onblur)
		{
			this.target = target;
			this.onfocus = onfocus;
			this.onblur = onblur;

			this.focusEvent = "focus";
			this.blurEvent = "blur";

			this._listenMouse();
			this.attachEvents();
		}

		attachEvents()
		{
			this.target.addEventListener(this.focusEvent, () => {
				this._removeMouse();
			});
			this.target.addEventListener(this.blurEvent, () => {
				this._listenMouse();
				this.onblur();
			});
		}

		_listenMouse()
		{
			this.target.addEventListener("mouseenter", this.onfocus);
			this.target.addEventListener("mouseleave", this.onblur);
		}

		_removeMouse()
		{
			this.target.removeEventListener("mouseenter", this.onfocus);
			this.target.removeEventListener("mouseleave", this.onblur);
		}
	}
}).call(this);