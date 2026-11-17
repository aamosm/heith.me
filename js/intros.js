// The introductions. Add ?intro=name to any page's address to show the one with that name,
// for example heith.me/?intro=studio. The choice then holds for the rest of the visit.
// An unknown or missing name shows "default".
//
// Each entry can set any of these, and takes whatever it leaves out from "default":
//   name       the heading
//   role       the line beside it
//   text       paragraphs for the left column
//   listTitle  the small heading over the list
//   list       rows of [label, text]. Use [] for no list.
//   closing    paragraphs under the list. Use [] for none.
window.DHC.intros = {
  default: {
    name: 'Dhruv Heith Chheda',
    role: 'Mauritian · Interdisciplinary student',
    text: [
      'I’m interested in games and the tools people use to make them. I enjoy programming, and I’d like a hand in the writing, visual decisions and coordination behind a project too. Working with a team appeals to me because there’s more than one way to contribute.',
      'I grew up playing GBA games on a laptop, and older games and emulation remain personal interests. I also like films that say a lot through simple choices. That’s something I’d like to explore in my own work.',
      'I’m usually up for a project or a competition, especially with teammates. Some of my projects started with someone around me needing something; others were ideas I wanted to try. I’ve worked independently, with school teams and during a robotics internship at IIT Gandhinagar.'
    ],
    listTitle: 'Some of the tools I’ve worked with',
    list: [
      ['Games', 'Godot and GDScript; currently learning Unity and C#.'],
      ['Visual work', 'Blender, Aseprite and After Effects.'],
      ['Programming', 'Python, C++ and JavaScript, with Git/GitHub for managing projects.'],
      ['CAD', 'SolidWorks.']
    ],
    closing: [
      'I’m open to internships and collaborations across programming, design and game production. You’re always welcome to contact me for a detailed CV, more about my work, or a project you’d like to discuss.'
    ]
  }

  // Add your own below, each with a comma after the one before it. A name is letters, digits and dashes.
  //
  // studio: {
  //   role: 'Applying for the design internship',
  //   text: ['First paragraph.', 'Second paragraph.'],
  //   closing: ['A closing line.']
  // }
};
