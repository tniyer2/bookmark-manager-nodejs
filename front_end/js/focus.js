

class awesomeFocus
{
	constructor(target, onfocus, onblur)
	{
		this.target = target;
		this.onfocus = onfocus;
		this.onblur = onblur;

		this.focusEvent = "focus";
		this.blurEvent = "blur";

		this.addMouse();
		this.attachEvents();
	}

	attachEvents()
	{
		this.target.addEventListener(this.focusEvent, () => {
			this.removeMouse();
		});
		this.target.addEventListener(this.blurEvent, () => {
			this.addMouse();
			this.onblur();
		});
	}

	addMouse()
	{
		this.target.addEventListener("mouseenter", this.onfocus);
		this.target.addEventListener("mouseleave", this.onblur);
	}

	removeMouse()
	{
		this.target.removeEventListener("mouseenter", this.onfocus);
		this.target.removeEventListener("mouseleave", this.onblur);
	}
}
