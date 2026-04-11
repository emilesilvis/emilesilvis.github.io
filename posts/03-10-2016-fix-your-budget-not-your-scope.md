---
title: "Fix your budget, not your scope"
seo_image: "/static/images/profile.png"
seo_description: "An alternative to fixed bid and time-and-materials contracts for software projects: fixed budget, scope controlled."
---

# Fix your budget, not your scope

Many software projects take on the form of a *transaction* between vendor and customer. A transaction is an exchange of value. The vendor supplies software to the customer that solves some problem (scope), costs a certain amount (budget), by some date (schedule). The customer (hopefully) pays the vendor.

In any exchange of value, there exists the possibility of an *unfair* exchange. That is the situation where one party gains more value out of the transaction than the other for some reason. This possibility of unfairness is the *risk* associated to the transaction.

Typical contractual agreements between vendor and customer distributes risk in a certain way.

## Fixed bid

*Fixed bid* projects fix the scope, budget and timeline. To get to a fixed scope, budget and timeline, the following implicit assumptions are made:

- We can know the entire problem upfront, before we actually start the project (scope). The vendor can then design a feasible solution and work out how many people will be required to build it (cost) and how long this will take (time)
- The problem space will never change (scope)

In this model, all the risk is carried by the vendor, and very little risk is carried by the customer. In my opinion, the problem space is largely unknown. You discover the problem as you try solving it. By the same token, the solution has to be emergent. By trying to fix the scope upfront you do nothing more than speculate at a time when you know least about the problem and solution space. If the scope changes at all, the vendor would often carry the cost of the change.

## Time and materials

With *time and materials* projects, the vendor simply charges the customer for any time spent. In this model, the customer carries all the risk. There are no guarantees for the customer around scope, budget and timelines. With time and materials the following implicit assumption are made:

- The vendor gets paid no matter what they produce
- The customer has very little control over the process

## Fixed budget, scope controlled

At [Platform45](http://www.platform45.com/) we've been experimenting with another alternative called *fixed budget, scope controlled* (I first saw this term used by [Atomic Object](https://atomicobject.com/)). It attempts to distribute the risk between vendor and customer more evenly. It makes the following implicit assumption: there will *never* be enough time or money to build everything you want (fixed budget), therefore, you have to carefully control what you build (scope controlled). It is fundamentally a lean approach. It distributes risk evenly between vendor and customer because the vendor knows what constraints they need to work in to solve the problems (fixed budget), and customers get full control over what is being built (scope controlled). The ability to "control the scope" is loosely based on the following list of principles and practices.

- An estimation is a snapshot of understanding at a given point in time based on a given set of assumptions. Assumptions will change as we validate our learning (and so estimates will change)
- Have short iterations / small batch sizes. This way you can handle changing assumptions and estimations without much waste
- Vendor commits to solve a set of problems within budget, not to provide specific solutions. This allows the scope to be fluid enough to solve the problem within the budget constraints
- There needs to be a continuous (at least once per iteration) negotiation between vendor and customer around priority for the next iteration
- Vendor and customer continuously need to monitor budget and let that be a guide for prioritisation

## It's about being lean

As mentioned before, most of the above boils down to a lean approach. As a vendor, some intentional education around this to the customer often helps a lot (I have often daydreamed about buying a stack of Lean Startup books and handing them out to new customers as mandatory reading).
