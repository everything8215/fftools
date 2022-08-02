// modal.js

class Modal {

  constructor() {
    this.div = document.getElementById('modal');

    const self = this;
    window.addEventListener('click', function onclick(e) {
      self.clickWindow(e);
    });

    // close the modal when the user clicks on <span> (x)
    const closeButton = document.getElementById('modal-close');
    closeButton.onclick = function() { self.close(); };
  }

  clickWindow(e) {
    if (e.target === this.div) this.close();
  }

  open(title) {
    const modalTitle = document.getElementById('modal-title');
    modalTitle.innerHTML = title;

    const content = document.getElementById('modal-content');
    content.innerHTML = '';

    this.div.classList.add('shown');
    return content;
  }

  close() {
    this.div.classList.remove('shown');
  }
}
